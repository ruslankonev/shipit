import { Command } from 'commander'
import chalk from 'chalk'
import Shipit from './Shipit.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

const program = new Command()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function exit(code) {
  if (process.platform === 'win32' && process.stdout.bufferSize) {
    process.stdout.once('drain', () => {
      process.exit(code)
    })
    return
  }

  process.exit(code)
}

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8'),
)

program
  .version(pkg.version)
  .allowUnknownOption()
  .usage('<environment> <tasks...>')
  .option('--shipitfile <file>', 'Specify a custom shipitfile to use')
  .option('--require <files...>', 'Script required before launching Shipit')
  .option('--tasks', 'List available tasks')
  .option('--environments', 'List available environments')

const opts = program.opts()

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.help()
}

function logTasks(shipit) {
  console.log(
    Object.keys(shipit.tasks)
      .join('\n')
      .trim(),
  )
}

function logEnvironments(shipit) {
  console.log(
    Object.keys(shipit.globalConfig)
      .join('\n')
      .trim(),
  )
}

function findConfigFile(shipitfile) {
  if (shipitfile) {
    if (existsSync(shipitfile)) {
      return { configPath: resolve(shipitfile) }
    }
    return null
  }

  const candidates = ['shipitfile.js', 'shipitfile.mjs', 'shipitfile.cjs']

  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate)
    if (existsSync(path)) {
      return { configPath: path }
    }
  }

  return null
}

async function asyncInvoke() {
  const env = findConfigFile(opts.shipitfile)

  if (!env || !env.configPath) {
    console.error(chalk.red('shipitfile not found'))
    exit(1)
  }

  if (opts.require) {
    for (const req of opts.require) {
      await import(resolve(req))
    }
  }

  const [environment, ...tasks] = program.args

  const shipit = new Shipit({ environment })

  try {
    const module = await import(env.configPath)
    const initialize =
      typeof module.default === 'function' ? module.default : module
    await initialize(shipit)
  } catch (error) {
    console.error(chalk.red('Could not load async config'))
    throw error
  }

  if (opts.tasks === true) {
    logTasks(shipit)
    exit(0)
  } else if (opts.environments === true) {
    logEnvironments(shipit)
    exit(0)
  } else {
    const runTasks = tasks.length === 0 ? ['default'] : tasks

    shipit.initialize()

    shipit.on('task_err', () => exit(1))
    shipit.on('task_not_found', () => exit(1))

    shipit.start(runTasks)
  }
}

asyncInvoke().catch(error => {
  setTimeout(() => {
    throw error
  })
})
