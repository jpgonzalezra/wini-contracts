const Wallet = require('ethereumjs-wallet');
const ethUtils = require('ethereumjs-util');
const { buildCreate2Address } = require('./helpers/utils');

const WiniWallet = artifacts.require('./Wallet.sol');
const WalletProxyFactory = artifacts.require('./WalletProxyFactory.sol');
const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');

const privateKeys = [
  ethUtils.toBuffer('0xced26e4f0ad256777efa4b205ac3003eca7e1befb9f657be58600b7115a6cdf1'),
  ethUtils.toBuffer('0x3132ce18b38230af1f8d751f5658c97e59d33a9e884676fddfc9cc4434cd36fb'),
  ethUtils.toBuffer('0x087df46b73931fd31751e80a203bb6be011f3ab2cf1930b2a92db901f0fdffc6'),
  ethUtils.toBuffer('0xeb558208fc7e52bc018d11414e6e624d0ab44a7cb63dfad9d75f913b45268746'),
];

const wallets = [
  Wallet.fromPrivateKey(privateKeys[0]),
  Wallet.fromPrivateKey(privateKeys[1]),
  Wallet.fromPrivateKey(privateKeys[2]),
  Wallet.fromPrivateKey(privateKeys[3]),
];

contract('WalletProxyFactory contract', () => {
  let factory;
  let wallet;

  const alice = wallets[0].getAddressString();
  const bob = wallets[1].getAddressString();
  let deploymentBytecode;

  before(async function () {
    // Setup contracts
    wallet = await WiniWallet.new();
    factory = await WalletProxyFactory.new(wallet.address);
    deploymentBytecode = await factory.deploymentBytecode();
  });

  describe('wini wallet factory operations', function () {
    it('Should compute the correct contract address without deploy', async () => {
      const computedAddr = buildCreate2Address(
        alice,
        deploymentBytecode,
        factory.address
      );
      assert.equal(computedAddr, await factory.getWalletAddress(alice));
    });
    it('Should compute the correct contract address with deploy', async () => {
      const computedAddr = buildCreate2Address(
        alice,
        deploymentBytecode,
        factory.address
      );

      ({ logs: this.logs } = await factory.createWallet(alice));
      expectEvent.inLogs(this.logs, 'Deployed', {
        _walletAddress: computedAddr,
      });
    });
    it('Should create wallet for bob', async () => {
      const computedAddr = buildCreate2Address(
        bob,
        deploymentBytecode,
        factory.address
      );

      ({ logs: this.logs } = await factory.createWallet(bob));
      expectEvent.inLogs(this.logs, 'Deployed', {
        _walletAddress: computedAddr,
      });
    });
    it('Should fail to create if already revealed', async function () {
      await expectRevert.unspecified(factory.createWallet(bob));
    });
    it('Should fail to init wini wallet source', async function () {
      const winiwallet = await WiniWallet.at(await factory.walletImplementation());
      await expectRevert(winiwallet.init(alice), 'Wallet already defined');
    });
  });
});
