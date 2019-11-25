const { buildCreate2Address, wallets } = require('./helpers/utils');

const WiniWallet = artifacts.require('./Wallet.sol');
const WalletProxyFactory = artifacts.require('./WalletProxyFactory.sol');
const { expectEvent, expectRevert } = require('openzeppelin-test-helpers');

contract('WalletProxyFactory contract', () => {
  let factory;
  let wallet;

  const alice = wallets[0];
  const bob = wallets[1];
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
