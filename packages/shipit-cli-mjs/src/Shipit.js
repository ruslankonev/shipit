import { ConnectionPool } from 'ssh-pool'
import Orchestrator from 'orchestrator'
import chalk from 'chalk'
import prettyTime from 'pretty-hrtime'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function formatError(e) {
  if (!e.err) {
    return e.message
  }

  if (typeof e.err.showStack === 'boolean') {
    return e.err.toString()
  }

  if (e.err.stack) {
    return e.err.stack
  }

  return new Error(String(e.err)).stack
}

class Shipit extends Orchestrator {
  constructor(options) {
    super()

    const defaultOptions = {
      stdout: process.stdout,
      stderr: process.stderr,
      log: console.log.bind(console),
    }

    this.config = {}
    this.globalConfig = {}
    this.options = { ...defaultOptions, ...options }
    this.environment = options.environment

    this.initializeEvents()

    if (this.options.stdout === process.stdout)
      process.stdout.setMaxListeners(100)

    if (this.options.stderr === process.stderr)
      process.stderr.setMaxListeners(100)
  }

  initialize() {
    if (!this.globalConfig[this.environment])
      throw new Error(`Environment '${this.environment}' not found in config`)

    this.emit('init')
    return this.initSshPool()
  }

  initializeEvents() {
    this.on('task_start', e => {
      if (this.tasks[e.task].fn.toString() === 'function () {}') return

      this.log('\nRunning', `'${chalk.cyan(e.task)}' task...`)
    })

    this.on('task_stop', e => {
      const task = this.tasks[e.task]
      if (task.fn.toString() === 'function () {}') {
        this.log(
          'Finished',
          `'${chalk.cyan(e.task)}'`,
          chalk.cyan(`[ ${task.dep.join(', ')} ]`),
        )
        return
      }

      const time = prettyTime(e.hrDuration)
      this.log(
        'Finished',
        `'${chalk.cyan(e.task)}'`,
        'after',
        chalk.magenta(time),
      )
    })

    this.on('task_err', e => {
      const msg = formatError(e)
      const time = prettyTime(e.hrDuration)
      this.log(
        `'${chalk.cyan(e.task)}'`,
        chalk.red('errored after'),
        chalk.magenta(time),
      )
      this.log(msg)
    })

    this.on('task_not_found', err => {
      this.log(chalk.red(`Task '${err.task}' is not in your shipitfile`))
      this.log(
        'Please check the documentation for proper shipitfile formatting',
      )
    })
  }

  initSshPool() {
    if (!this.config.servers) throw new Error('Servers not filled')

    const servers = Array.isArray(this.config.servers)
      ? this.config.servers
      : [this.config.servers]

    const options = {
      ...this.options,
      key: this.config.key,
      asUser: this.config.asUser,
      strict: this.config.strict,
      verbosityLevel:
        this.config.verboseSSHLevel === undefined
          ? 0
          : this.config.verboseSSHLevel,
    }

    this.pool = new ConnectionPool(servers, options)

    this.emit('init:after_ssh_pool')
    return this
  }

  initConfig(config = {}) {
    this.globalConfig = config
    this.config = {
      ...config.default,
      ...config[this.environment],
    }
    return this
  }

  local(command, options = {}) {
    this.log('Running "%s" on local.', command)
    const prefix = '@ '

    const { spawn } = require('child_process')

    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options,
      })

      if (this.options.stdout && child.stdout) {
        child.stdout.on('data', data => {
          this.options.stdout.write(prefix + data)
        })
      }

      if (this.options.stderr && child.stderr) {
        child.stderr.on('data', data => {
          this.options.stderr.write(prefix + data)
        })
      }

      child.on('close', code => {
        resolve({ code, child })
      })

      child.on('error', reject)
    })
  }

  async remote(command, options) {
    return this.pool.run(command, options)
  }

  async remoteCopy(src, dest, options) {
    const defaultOptions = {
      ignores: this.config && this.config.ignores ? this.config.ignores : [],
      rsync: this.config && this.config.rsync ? this.config.rsync : [],
    }
    const copyOptions = { ...defaultOptions, ...options }

    return this.pool.copy(src, dest, copyOptions)
  }

  async copyToRemote(src, dest, options) {
    const defaultOptions = {
      ignores: this.config && this.config.ignores ? this.config.ignores : [],
      rsync: this.config && this.config.rsync ? this.config.rsync : [],
    }
    const copyOptions = { ...defaultOptions, ...options }
    return this.pool.copyToRemote(src, dest, copyOptions)
  }

  async copyFromRemote(src, dest, options) {
    const defaultOptions = {
      ignores: this.config && this.config.ignores ? this.config.ignores : [],
      rsync: this.config && this.config.rsync ? this.config.rsync : [],
    }
    const copyOptions = { ...defaultOptions, ...options }
    return this.pool.copyFromRemote(src, dest, copyOptions)
  }

  log(...args) {
    this.options.log(...args)
  }

  blTask(name, ...rest) {
    this.task(name, ...rest)
    const task = this.tasks[name]
    task.blocking = true
    return task
  }

  _readyToRunTask(...args) {
    if (
      Object.keys(this.tasks).some(key => {
        const task = this.tasks[key]
        return task.running === true && task.blocking === true
      })
    )
      return false

    return super._readyToRunTask(...args)
  }
}

export default Shipit
