'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
const actionhero = new ActionheroPrototype()
let api

describe('Task Middleware', () => {
  describe('enqueue modification', () => {
    before(async () => {
      api = await actionhero.start()
      const middleware = {
        name: 'test-middleware',
        priority: 1000,
        global: false,
        preEnqueue: function (next) {
          next(new Error('You cannot enqueue me!'), false)
        }
      }

      api.tasks.addMiddleware(middleware)

      api.tasks.tasks.middlewareTask = {
        name: 'middlewareTask',
        description: 'middlewaretask',
        queue: 'default',
        frequency: 0,
        middleware: ['test-middleware'],
        run: function (api, params, next) {
          next(new Error('Should never get here'))
        }
      }

      api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')
    })

    after(async () => {
      api.tasks.globalMiddleware = []
      await actionhero.stop()
    })

    it('can modify the behavior of enqueue with middleware.preEnqueue', async () => {
      try {
        await api.tasks.enqueue('middlewareTask', {})
      } catch (error) {
        expect(error.toString()).to.be.equal('Error: You cannot enqueue me!')
      }
    })
  })

  describe('Pre and Post processing', () => {
    before(async () => {
      api = await actionhero.start()
      const middleware = {
        name: 'test-middleware',
        priority: 1000,
        global: false,
        preProcessor: function (next) {
          try {
            let params = this.args[0]
            expect(params).to.equal(taskParams)
            params.test = true
            next()
          } catch (e) {
            next(e)
          }
        },
        postProcessor: function (next) {
          try {
            let worker = this.worker
            let params = this.args[0]
            expect(params.test).to.equal(true) // Requires disableParamScrubbing or that `test` be a valid param
            let result = worker.result
            expect(result.result).to.equal('done')
            result.result = 'fin'

            next(null, result)
          } catch (e) {
            next(e)
          }
        },
        preEnqueue: function (next) {
          let params = this.args[0]
          if (params.invalid) {
            return next(new Error('Invalid Parameter'), false)
          }
          next()
        }
      }

      api.tasks.addMiddleware(middleware)

      api.tasks.tasks.middlewareTask = {
        name: 'middlewareTask',
        description: 'middlewaretask',
        queue: 'default',
        frequency: 0,
        middleware: ['test-middleware'],
        run: function (api, params, next) {
          expect(params.test).to.be.ok()
          next(null, {result: 'done'})
        }
      }

      api.tasks.jobs.middlewareTask = api.tasks.jobWrapper('middlewareTask')
    })

    after(async () => {
      api.tasks.globalMiddleware = []
      await actionhero.stop()
    })

    it('can modify parameters before a task and modify result after task completion', async () => {
      const {result} = await api.specHelper.runFullTask('middlewareTask', {foo: 'bar'})
      expect(result).to.equal('fin')
    })

    // it('should reject task with improper params', (done) => {
    //   api.tasks.enqueue('middlewareTask', {invalid: true}, 'test', (error, toRun) => {
    //     expect(error).to.be.ok()
    //     expect(error.message).to.equal('Invalid Parameter')
    //     api.tasks.queued('test', 0, 999, (error, tasks) => {
    //       expect(error).to.be.null()
    //       expect(tasks).to.have.length(0)
    //       done()
    //     })
    //   })
    // })
  })
})
