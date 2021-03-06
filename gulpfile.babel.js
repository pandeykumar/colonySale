/* eslint-env node */
/* eslint no-use-before-define: 0, complexity: 0, arrow-body-style: 0 */

import originalGulp from 'gulp';
import gulpHelp from 'gulp-help';
import shell from 'pshell';
import request from 'request';
import minimist from 'minimist';
import rimraf from 'rimraf';

const getEnv = envVar => process.env[envVar];
const gulp = gulpHelp(originalGulp, {
  hideEmpty: true,
  hideDepsMessage: true,
});
const options = minimist(process.argv.slice(2));

const gethClient = 'testrpc';

gulp.task('deploy:contracts', [gethClient, 'clean:contracts'], () => {
  return execute(`truffle migrate --reset`);
});

gulp.task('clean:contracts', done => rimraf('./build/contracts/*', done));

const cleanUpgradeTempContracts = () => {
  return new Promise((resolve, reject) => {
    rimraf('./contracts/Updated*.*', resolve);
  });
};

gulp.task('lint:contracts', 'Lint contracts', () => {
  return execute('solium --dir . || true');
});

const checkCoverageAgainstThreshold = () => {
  return execute('istanbul check-coverage --statements 100 --branches 00 --functions 100 --lines 100');
};

gulp.task('generate:contracts:integration', ['deploy:contracts'], async () => {
  return execute(`cp Token.sol UpdatedToken.sol`, { cwd: './contracts' })
  .then(execute(`cp Resolver.sol UpdatedResolver.sol`, { cwd: './contracts' }))
  .then(execute(`sed -ie'' s/'Token'/'UpdatedToken'/g UpdatedToken.sol`, { cwd: './contracts' }))
  .then(execute(`sed -ie'' s/'Resolver'/'UpdatedResolver'/g UpdatedResolver.sol`, { cwd: './contracts' }))
  .then(execute(`sed -ie'' s/'function mint'/'function isUpdated() constant returns(bool) {return true;} function mint'/g UpdatedToken.sol`, { cwd: './contracts' }))
  .then(execute(`sed -ie'' s/'function stringToSig'/'function isUpdated() constant returns(bool) {return true;} function stringToSig'/g UpdatedResolver.sol`, { cwd: './contracts' }))
  .then(execute(`sed -ie'' s/'Pointer(destination, 0);'/'Pointer(destination, 0); pointers[stringToSig("isUpdated()")] = Pointer(destination, 32);'/g UpdatedResolver.sol`, { cwd: './contracts' }));
});

gulp.task('testrpc', async () => {
  const cmd = makeCmd(`
    testrpc
    --account="0x0355596cdb5e5242ad082c4fe3f8bbe48c9dba843fe1f99dd8272f487e70efae, 100000000000000000000"
    --account="0xe9aebe8791ad1ebd33211687e9c53f13fe8cca53b271a6529c7d7ba05eda5ce2, 100000000000000000000"
    --account="0x6f36842c663f5afc0ef3ac986ec62af9d09caa1bbf59a50cdb7334c9cc880e65, 100000000000000000000"
    --account="0xf184b7741073fc5983df87815e66425928fa5da317ef18ef23456241019bd9c7, 100000000000000000000"
    --account="0x7770023bfebe3c8e832b98d6c0874f75580730baba76d7ec05f2780444cc7ed3, 100000000000000000000"
    --account="0xa9442c0092fe38933fcf2319d5cf9fd58e3be5409a26e2045929f9d2a16fb090, 100000000000000000000"
    --account="0x06af2c8000ab1b096f2ee31539b1e8f3783236eba5284808c2b17cfb49f0f538, 100000000000000000000"
    --account="0x7edaec9e5f8088a10b74c1d86108ce879dccded88fa9d4a5e617353d2a88e629, 100000000000000000000"
    --account="0xe31c452e0631f67a629e88790d3119ea9505fae758b54976d2bf12bd8300ef4a, 100000000000000000000"
    --account="0x5e383d2f98ac821c555333e5bb6109ca41ae89d613cb84887a2bdb933623c4e3, 100000000000000000000"
    --account="0x33d2f6f6cc410c1d46d58f17efdd2b53a71527b27eaa7f2edcade351feb87425, 100000000000000000000"
    --account="0x32400a48ff16119c134eef44e2627502ce6e367bc4810be07642275a9db47bf7, 100000000000000000000"
    `);
  executeDetached(cmd);
  return waitForPort('8545');
});

gulp.task('parity', async () => {
  const out = await executeWithOutput('parity --keys-path ./keys account list');
  const addresses = out.replace(/(\[|\]|\n)/g, '').split(', ');

  if (!addresses.length) {
    throw new Error('No parity addresses found. Did you initialise it correctly?');
  }
  const cmd = makeCmd(`
    parity --chain ./parity-genesis.json
    --author ${addresses[2]}
    --unlock ${addresses[0]},${addresses[1]},${addresses[2]}
    --password ./parityPassword --keys-path ./keys --geth --no-dapps
    --tx-gas-limit 0x47E7C4 --gasprice 0x0 --gas-floor-target 0x47E7C4
    --reseal-on-txs all --reseal-min-period 0
    --jsonrpc-interface all --jsonrpc-hosts all --jsonrpc-cors="http://localhost:3000"
  `);
  executeDetached(cmd);
  return waitForPort('8545');
});

gulp.task('geth', () => {
  const cmd = makeCmd(`
    geth init ./genesis.json &&
    geth --networkid 19191919191 --rpc --password ./password
    --unlock "0,1,2" --rpccorsdomain "*" --rpcaddr "127.0.0.1"
    --rpcport "8545" --mine --etherbase "2"
  `);
  executeDetached(cmd);
  return waitForPort('8545');
});

gulp.task('test:contracts', 'Run contract tests', ['deploy:contracts', 'lint:contracts'], () => {
  const cmd = makeCmd(`truffle test`);
  return execute(cmd);
});

gulp.task('test:contracts:gasCosts', 'Run gas cost tests', ['deploy:contracts'], () => {
  const cmd = makeCmd(`truffle test gasCosts/gas-costs.js`);
  return execute(cmd);
});

gulp.task('test:contracts:upgrade', 'Run contract upgrade tests', ['deploy:contracts', 'generate:contracts:integration'], () => {
  const cmd = makeCmd(`truffle test ./upgrade-test/* --network integration`);
  return execute(cmd).then(cleanUpgradeTempContracts);
});

gulp.task('test:contracts:coverage', 'Run contract test coverage using solidity-coverage', () => {
  const cmd = makeCmd(`solidity-coverage`);
  return execute(cmd).then(checkCoverageAgainstThreshold);
});

const waitForPort = port => {
  return new Promise(resolve => {
    const req = () => {
      request({
        url: 'http://127.0.0.1:' + port,
        rejectUnauthorized: false,
      }, err => {
        if (!err) {
          return resolve(true);
        }
        return setTimeout(req, 2000);
      });
    };
    req();
  });
};

const shellContext = shell.context({
  echoCommand: false,
  env: {
    PATH: ['node_modules/.bin', process.env.PATH],
  },
});

const execute = (cmd, opts) => {
  return shellContext(cmd, {
    ...(opts || {}),
  }).catch(() => process.exit(1));
};

const executeWithOutput = (cmd, opts) => execute(cmd, { captureOutput: true, ...(opts || {}) })
  .then(res => res.stdout);

const executeDetached = (cmd, opts) => {
  const { childProcess: child, promise } = shellContext.exec(cmd, {
    detached: true,
    stdio: 'ignore',
    ...(opts || {}),
  });
  child.unref();
  promise.catch(e => { console.error(e); process.exit(1); });
  const killProcess = e => {
    if (e) { console.error(e); }
    console.log(`Cleaning up. Killing child process ${child.pid}...`);
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (err) {
      /* ignore those */
    }
  };
  process.on('exit', killProcess);
  process.on('uncaughtException', killProcess);
  process.on('unhandledRejection', killProcess);
};

const makeCmd = cmd => cmd.replace(/\s+/g, ' ');

process.on('SIGINT', () => {
  console.log('Caught interrupt signal. Exiting gracefully...');
  process.exit();
});
