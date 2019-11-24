const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { encodeData, getId, signHash } = require('./helpers/utils');

const Wallet = artifacts.require('./Wallet.sol');
const WalletExecutor = artifacts.require('./WalletExecutor.sol');
const WalletProxyFactory = artifacts.require('./WalletProxyFactory.sol');
const TestERC20 = artifacts.require('./TestERC20.sol');
const TestERC721 = artifacts.require('./TestERC721.sol');
const TestOutOfGasContract = artifacts.require('./TestOutOfGasContract.sol');
const TestTransfer = artifacts.require('./TestTransfer.sol');
const TestSelfDestruct = artifacts.require('./TestSelfDestruct.sol');

contract('Wini Wallet wallets', function (accounts) {
  const PREFIX = '0x';
  const alice = accounts[0];
  const bob = accounts[1];
  const charly = accounts[2];
  const david = accounts[3];

  const privateKeyAlice = '0x3132ce18b38230af1f8d751f5658c97e59d33a9e884676fddfc9cc4434cd36fb';
  const privateKeyBob = '0x087df46b73931fd31751e80a203bb6be011f3ab2cf1930b2a92db901f0fdffc6';

  let creator;
  let executor;
  let destruct;
  let testERC20;
  let testERC721;

  before(async function () {
    // Setup contracts
    const wallet = await Wallet.new();
    creator = await WalletProxyFactory.new(wallet.address);
    executor = await WalletExecutor.new();
    destruct = await TestSelfDestruct.new();
    testERC20 = await TestERC20.new();
    testERC721 = await TestERC721.new();
  });
  describe('Create wini wallets', function () {
    it('Should create wini wallet', async function () {
      const wallet = await Wallet.new();
      const creator = await WalletProxyFactory.new(wallet.address);
      await creator.createWallet(alice);
    });
    it('Should predict the Wini Wallet', async function () {
      const predicted = await creator.getWalletAddress(bob);
      assert.equal(PREFIX, await web3.eth.getCode(predicted), 'Wini Wallet already exists');
      await creator.createWallet(bob);
      assert.notEqual(PREFIX, await web3.eth.getCode(predicted), 'Wini Wallet is not created');
    });
    it('Should fail to create if already revealed', async function () {
      await expectRevert.unspecified(creator.createWallet(bob));
    });
    it('Should fail to init Wini Wallet source', async function () {
      const wini = await Wallet.at(await creator.walletImplementation());
      await expectRevert(wini.init(alice), 'Wallet already defined');
    });
  });
  describe('Relay intents', function () {
    it('Should relay signed tx, send ETH', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await web3.eth.sendTransaction({ from: alice, to: wallet.address, value: 1 });

      const to = david;
      const value = 1;
      const data = PREFIX;
      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x11115';

      const callData = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        callData
      );

      const prevBalanceReceiver = new BN(await web3.eth.getBalance(david));
      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(new BN(1));

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        callData,
        signature
      );

      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(new BN(0));
      expect(new BN(await web3.eth.getBalance(david)).sub(prevBalanceReceiver)).to.be.bignumber.equal(new BN(1));
    });
    it('Should relay signed tx, send ETH, without salt', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await web3.eth.sendTransaction({ from: alice, to: wallet.address, value: 1 });

      const to = david;
      const value = 1;
      const data = PREFIX;
      const minGasLimit = 0;
      const maxGasPrice = new BN(10).pow(new BN(32));

      const callData = web3.eth.abi.encodeParameters(
        ['address', 'uint256', 'bytes', 'uint256', 'uint256'],
        [to, value, data, minGasLimit, maxGasPrice.toString()]
      );

      const id = getId(
        wallet.address,
        executor.address,
        callData
      );

      const prevBalanceReceiver = new BN(await web3.eth.getBalance(david));
      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(new BN(1));

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        callData,
        signature
      );

      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(new BN(0));
      expect(new BN(await web3.eth.getBalance(david)).sub(prevBalanceReceiver))
        .to.be.bignumber.equal(new BN(1));
    });
    it('Should relay signed tx, send tokens', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 4]);

      const minGasLimit = new BN(2000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = PREFIX;
      const callData = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        callData
      );

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        callData,
        signature
      );

      expect(await testERC20.balanceOf(david)).to.be.bignumber.equal(new BN(4));
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(6));
    });
    it('Should fail to relay if transaction is wronly signed', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await web3.eth.sendTransaction({ from: alice, to: wallet.address, value: 1 });

      const to = david;
      const value = 1;
      const data = PREFIX;
      const minGasLimit = 0;
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x1';

      const callData = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        callData
      );

      const prevBalanceReceiver = new BN(await web3.eth.getBalance(david));
      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(new BN(1));

      const signature = signHash(id, privateKeyBob);
      await expectRevert(wallet.relayIntent(
        executor.address,
        callData,
        signature
      ), 'Invalid signature');

      await expectRevert(wallet.relayIntent(
        executor.address,
        callData,
        PREFIX
      ), 'Invalid signature');

      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(new BN(1));
      expect(new BN(await web3.eth.getBalance(david)).sub(prevBalanceReceiver))
        .to.be.bignumber.equal(new BN(0));
    });
    it('Should fail to relay is intent is already relayed', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      const to = david;
      const value = 0;
      const data = PREFIX;
      const minGasLimit = 0;
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x4';

      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt,
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);

      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      await expectRevert(wallet.relayIntent(
        executor.address,
        calldata,
        signature
      ), 'Intent already relayed');
    });
    it('Should relay sending intent from signer (without signature)', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      const preBalance = new BN(await web3.eth.getBalance(wallet.address));
      await web3.eth.sendTransaction({ from: alice, to: wallet.address, value: 1 });

      const to = david;
      const value = 1;
      const data = PREFIX;
      const minGasLimit = 0;
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = PREFIX;
      const prevBalanceReceiver = new BN(await web3.eth.getBalance(david));
      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(preBalance.add(new BN(1)));

      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      await wallet.relayIntent(
        executor.address,
        calldata,
        PREFIX,
        {
          from: bob,
        }
      );

      expect(new BN(await web3.eth.getBalance(wallet.address))).to.be.bignumber.equal(preBalance);
      expect(new BN(await web3.eth.getBalance(david)).sub(prevBalanceReceiver)).to.be.bignumber.equal(new BN(1));
    });
    it('Should fail to realy with low gas limit', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 4]);

      const minGasLimit = new BN(7000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x6';
      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);
      await expectRevert.unspecified(wallet.relayIntent(
        executor.address,
        calldata,
        signature,
        {
          gas: 100000,
        }
      ));

      expect(await testERC20.balanceOf(david)).to.be.bignumber.equal(new BN(0));
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(10));
    });
    it('Should fail to relay with high gas price', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 4]);

      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(5);
      const salt = '0x6';
      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);
      await expectRevert(wallet.relayIntent(
        executor.address,
        calldata,
        signature
      ), 'Gas price too high');

      expect(await testERC20.balanceOf(david)).to.be.bignumber.equal(new BN(0));
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(10));
    });
    it('Should save relayed block number', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      const to = wallet.address;
      const value = 0;
      const data = PREFIX;
      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x10';
      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      expect(await wallet.getBlockOfIntentExecution(id)).to.be.bignumber.equal(new BN(await web3.eth.getBlockNumber()));
    });
    it('Should save relayed by', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      const to = wallet.address;
      const value = 0;
      const data = PREFIX;
      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x11';
      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      expect(await wallet.getIntentRelayer(id)).to.be.equal(alice);
    });
    it('Should not fail relay if call fails', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 11]);

      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x12';
      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      expect(await wallet.getIntentRelayer(id)).to.be.equal(alice);
      expect(await testERC20.balanceOf(david)).to.be.bignumber.equal(new BN(0));
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(10));
    });
    it('Should catch if call is out of gas', async function () {
      const testContract = await TestOutOfGasContract.new();
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      const to = testContract.address;
      const value = 0;
      const data = PREFIX;
      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x12';
      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);
      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      expect(await wallet.getIntentRelayer(id)).to.be.equal(alice);
    });
  });
  describe('Cancel intents', function () {
    it('Should cancel intent and fail to relay', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      // Create transfer intent
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 3]);

      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x13';

      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);

      const cancelTo = wallet.address;
      const cancelValue = 0;
      const cancelData = web3.eth.abi.encodeFunctionCall({
        name: 'cancel',
        type: 'function',
        inputs: [{
          type: 'bytes32',
          name: '_id',
        }],
      }, [id]);

      const cancelMinGasLimit = new BN(900000);
      const cancelMaxGasPrice = new BN(10).pow(new BN(32));
      const cancelSalt = '0x14';

      const cancelCallData = encodeData(
        cancelTo,
        cancelValue,
        cancelData,
        cancelMinGasLimit,
        cancelMaxGasPrice,
        cancelSalt
      );

      const cancelId = getId(
        wallet.address,
        executor.address,
        cancelCallData
      );

      const cancelSignature = signHash(cancelId, privateKeyAlice);

      await wallet.relayIntent(
        executor.address,
        cancelCallData,
        cancelSignature
      );

      expect(await wallet.isIntentCanceled(id)).to.be.equal(true);

      // Try to relayIntent transfer
      await expectRevert(wallet.relayIntent(
        executor.address,
        calldata,
        signature
      ), 'Intent was canceled');

      expect(await testERC20.balanceOf(david)).to.be.bignumber.equal(new BN(0));
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(10));
    });
    it('Should fail to cancel intent from different wallet', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      // Create transfer intent
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 3]);

      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x14';

      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);

      // Try to cancel intent
      await expectRevert(wallet.cancel(id), 'Only wallet can cancel txs');
      expect(await wallet.isIntentCanceled(id)).to.be.equal(false);

      // Relay ERC20 transfer should success
      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      expect(await testERC20.balanceOf(david)).to.be.bignumber.equal(new BN(3));
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(7));
    });
    it('Should fail to cancel intent if already relayed', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      // Create transfer intent
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = wallet.address;
      const value = 0;
      const data = PREFIX;
      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x16';

      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      const signature = signHash(id, privateKeyAlice);

      // Relay intent
      await wallet.relayIntent(
        executor.address,
        calldata,
        signature
      );

      // Create cancel intent
      const cancelTo = wallet.address;
      const cancelValue = 0;
      const cancelData = web3.eth.abi.encodeFunctionCall({
        name: 'cancel',
        type: 'function',
        inputs: [{
          type: 'bytes32',
          name: '_id',
        }],
      }, [id]);

      const cancelMinGasLimit = new BN(0);
      const cancelMaxGasPrice = new BN(10).pow(new BN(32));
      const cancelSalt = '0x17';

      const cancelCallData = encodeData(
        cancelTo,
        cancelValue,
        cancelData,
        cancelMinGasLimit,
        cancelMaxGasPrice,
        cancelSalt
      );

      const cancelId = getId(
        wallet.address,
        executor.address,
        cancelCallData
      );

      const cancelSignature = signHash(cancelId, privateKeyAlice);

      const cancelReceipt = await wallet.relayIntent(
        executor.address,
        cancelCallData,
        cancelSignature
      );

      expect(await wallet.isIntentCanceled(id)).to.be.equal(false);
      expect(await wallet.getIntentRelayer(id)).to.be.equal(alice);

      const log = web3.eth.abi.decodeLog([{
        type: 'bool',
        name: '_success',
      }, {
        type: 'bytes',
        name: '_result',
        indexed: true,
      }], cancelReceipt.receipt.rawLogs[1].data, []);

      expect(log._success).to.be.equal(false);
    });
    it('Should fail to cancel intent if already canceled', async function () {
      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      // Create transfer intent
      await testERC20.setBalance(wallet.address, 10);
      await testERC20.setBalance(david, 0);

      const to = wallet.address;
      const value = 0;
      const data = PREFIX;
      const minGasLimit = new BN(1000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      const salt = '0x19';

      const calldata = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      const id = getId(
        wallet.address,
        executor.address,
        calldata
      );

      // Create cancel intent
      const cancelTo = wallet.address;
      const cancelValue = 0;
      const cancelData = web3.eth.abi.encodeFunctionCall({
        name: 'cancel',
        type: 'function',
        inputs: [{
          type: 'bytes32',
          name: '_id',
        }],
      }, [id]);

      const cancelMinGasLimit = new BN(90000);
      const cancelMaxGasPrice = new BN(10).pow(new BN(32));
      const cancelSalt = '0x17';

      const cancelCallData = encodeData(
        cancelTo,
        cancelValue,
        cancelData,
        cancelMinGasLimit,
        cancelMaxGasPrice,
        cancelSalt
      );

      const cancelId = getId(
        wallet.address,
        executor.address,
        cancelCallData
      );

      const cancelPrevto = wallet.address;
      const cancelPrevValue = 0;
      const cancelPrevData = web3.eth.abi.encodeFunctionCall({
        name: 'cancel',
        type: 'function',
        inputs: [{
          type: 'bytes32',
          name: '_id',
        }],
      }, [id]);

      const cancelPrevMinGasLimit = new BN(0);
      const cancelPrevMaxGasPrice = new BN(10).pow(new BN(32));
      const cancelPrevSalt = '0x18';
      const cancelPrevExpiration = await time.latest() + 86400;

      const cancelPrevCallData = encodeData(
        cancelPrevto,
        cancelPrevValue,
        cancelPrevData,
        cancelPrevMinGasLimit,
        cancelPrevMaxGasPrice,
        cancelPrevSalt,
        cancelPrevExpiration
      );

      const cancelPrevId = getId(
        wallet.address,
        executor.address,
        cancelPrevCallData
      );

      const cancelSignature = signHash(cancelId, privateKeyAlice);
      const cancelSecondSignature = signHash(cancelPrevId, privateKeyAlice);

      const cancelFirstReceipt = await wallet.relayIntent(
        executor.address,
        cancelCallData,
        cancelSignature
      );

      const cancelSecondReceipt = await wallet.relayIntent(
        executor.address,
        cancelPrevCallData,
        cancelSecondSignature
      );

      expect(await wallet.isIntentCanceled(id)).to.be.equal(true);

      const cancelFirstReceiptLog = web3.eth.abi.decodeLog([{
        type: 'bool',
        name: '_success',
      }, {
        type: 'bytes',
        name: '_result',
        indexed: true,
      }], cancelFirstReceipt.receipt.rawLogs[2].data, []);

      expect(cancelFirstReceiptLog._success).to.be.equal(true);

      const cancelSecondReceiptLog = web3.eth.abi.decodeLog([{
        type: 'bool',
        name: '_success',
      }, {
        type: 'bytes',
        name: '_result',
        indexed: true,
      }], cancelSecondReceipt.receipt.rawLogs[1].data, []);

      expect(cancelSecondReceiptLog._success).to.be.equal(false);
    });
  });
  describe('Receive txs', function () {
    it('Should receive ETH using transfer', async function () {
      const transferUtil = await TestTransfer.new();

      const randomWallet = await creator.getWalletAddress(transferUtil.address);
      await transferUtil.transfer(randomWallet, { from: david, value: 100 });

      const balance = new BN(await web3.eth.getBalance(randomWallet));
      expect(balance).to.be.bignumber.equal(new BN(100));
    });
    it('Should receive ERC721 tokens', async function () {
      const token = 3581591738;
      await testERC721.mint(alice, token);

      expect(await testERC721.ownerOf(token)).to.be.equal(alice);

      const wallet = await Wallet.at(await creator.getWalletAddress(bob));

      await testERC721.safeTransferFrom(alice, wallet.address, token, { from: alice });
      expect(await testERC721.ownerOf(token)).to.be.equal(wallet.address);
    });
  });
  describe('Destroy', function () {
    it('Wini Wallet is destroyable', async function () {
      // Reveal wallet
      await creator.createWallet(charly);
      const wallet = await Wallet.at(await creator.getWalletAddress(charly));

      // Set balance and transfer
      await testERC20.setBalance(wallet.address, 10);
      const to = testERC20.address;
      const value = 0;
      const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [{
          type: 'address',
          name: 'to',
        }, {
          type: 'uint256',
          name: 'value',
        }],
      }, [david, 2]);

      const minGasLimit = new BN(2000000);
      const maxGasPrice = new BN(10).pow(new BN(32));
      let salt = PREFIX;

      let callData = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      let id = getId(
        wallet.address,
        executor.address,
        callData
      );

      let signature = signHash(id, privateKeyBob);
      await wallet.relayIntent(
        executor.address,
        callData,
        signature
      );

      const ogcalldata = callData;
      const ogsignature = signature;

      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(8));

      // Destroy wallet
      id = getId(
        wallet.address,
        destruct.address,
        '0x00'
      );

      await wallet.relayIntent(
        destruct.address,
        '0x00',
        signHash(id, privateKeyBob)
      );

      // Wini Wallet should be destroyed
      // should fail to send tokens
      salt = '0x01';
      callData = encodeData(
        to,
        value,
        data,
        minGasLimit,
        maxGasPrice,
        salt
      );

      id = getId(
        wallet.address,
        executor.address,
        callData
      );

      signature = signHash(id, privateKeyBob);
      await wallet.relayIntent(
        executor.address,
        callData,
        signature
      );

      // token count remains the same
      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(8));

      // Recreate wallet
      await creator.createWallet(charly);

      // Relay token send
      await wallet.relayIntent(
        executor.address,
        callData,
        signature
      );

      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(6));

      // WARNING
      // Loses replay protection and receipts of previous intents
      await wallet.relayIntent(
        executor.address,
        ogcalldata,
        ogsignature
      );

      expect(await testERC20.balanceOf(wallet.address)).to.be.bignumber.equal(new BN(4));
    });
  });
});
