const outdent = require('outdent')

const argv = require('yargs')
  .option('open-browser', {
    describe: 'Automatically open the browser when you run demopack.',
    default: true,
  })
  .option('build', {
    describe:
      'Output static files into a directory. JS and CSS will be minified',
    default: false,
  })
  .option('css-modules', {
    describe: 'Enable CSS Modules support.',
    default: false,
  })
  .option('entry', {
    describe: 'The JavaScript file that demopack should build from.',
    default: 'index.js',
  }).epilogue(outdent`
    Demopack: Version ${require('../package.json').version}

    Easily run some JavaScript and CSS locally via preconfigured Webpack.

    Demopack supports the following by default:
      - JavaScript & JSX transpilation, including stage-0 and above proposals.
      - Sass and CSS, including optional support for CSS Modules.
        - (use the --css-modules flag to enable them)
      - Image assets - gif, jpg, png and svg will be loaded for you.

    Questions, bugs or suggestions? https://github.com/jackfranklin/demopack
  `).argv

const makeWebpackConfig = require('../lib/webpack-config')
const webpack = require('webpack')
const demopackBuild = require('./demopack-build')
const WebpackDevServer = require('webpack-dev-server')
const {
  choosePort,
  prepareUrls,
  prepareProxy,
} = require('react-dev-utils/WebpackDevServerUtils')
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages')
const clearConsole = require('react-dev-utils/clearConsole')
const openBrowser = require('react-dev-utils/openBrowser')
const chalk = require('chalk')
const createCompiler = require('../lib/create-compiler')
const createDevServerConfig = require('../lib/create-dev-server-config')
const path = require('path')

if (argv.help) {
  process.exit(0)
}

const webpackConfig = makeWebpackConfig(argv)

if (argv.build) {
  console.log(chalk.blue('Building into ./demopack-built'))
  demopackBuild(webpackConfig)
  return
}

// taken from create-elm-app and then edited
// https://github.com/halfzebra/create-elm-app/blob/master/scripts/start.js

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8080
const HOST = process.env.HOST || '0.0.0.0'

const isInteractive = process.stdout.isTTY

// We attempt to use the default port but if it is busy, we offer the user to
// run on a different port. `detect()` Promise resolves to the next free port.
choosePort(HOST, DEFAULT_PORT)
  .then(port => {
    if (port == null) {
      // We have not found a port.
      return
    }
    const appName = path.basename(path.dirname(process.cwd()))
    const urls = prepareUrls('http', HOST, port)
    // Create a webpack compiler that is configured with custom messages.
    const compiler = createCompiler(webpack, webpackConfig, appName, urls)
    // TODO: Load proxy config
    // const proxySetting = require(paths.elmPackageJson).proxy
    // const proxyConfig = prepareProxy(proxySetting, '/')
    // Serve webpack assets generated by the compiler over a web sever.
    const proxyConfig = {}
    const serverConfig = createDevServerConfig(
      webpackConfig,
      proxyConfig,
      urls.lanUrlForConfig
    )
    const devServer = new WebpackDevServer(compiler, serverConfig)
    // Launch WebpackDevServer.
    devServer.listen(port, HOST, err => {
      if (err) {
        return console.log(err)
      }
      if (isInteractive) {
        clearConsole()
      }
      console.log(chalk.cyan('Starting the development server...\n'))
      if (argv.openBrowser) openBrowser(urls.localUrlForBrowser)
    })
    ;['SIGINT', 'SIGTERM'].forEach(sig => {
      process.on(sig, () => {
        devServer.close()
        process.exit()
      })
    })
  })
  .catch(err => {
    if (err && err.message) {
      console.log(err.message)
    }
    process.exit(1)
  })
