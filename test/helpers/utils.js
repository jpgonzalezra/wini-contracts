const ethereumUtil = require('ethereumjs-util');
const Wallet = require('ethereumjs-wallet');

const privateKeys = [
  ethereumUtil.toBuffer('0xced26e4f0ad256777efa4b205ac3003eca7e1befb9f657be58600b7115a6cdf1'),
  ethereumUtil.toBuffer('0x3132ce18b38230af1f8d751f5658c97e59d33a9e884676fddfc9cc4434cd36fb'),
  ethereumUtil.toBuffer('0x087df46b73931fd31751e80a203bb6be011f3ab2cf1930b2a92db901f0fdffc6'),
  ethereumUtil.toBuffer('0xeb558208fc7e52bc018d11414e6e624d0ab44a7cb63dfad9d75f913b45268746'),
  ethereumUtil.toBuffer('0xde43de7119a20ee767b39b926058096f95812058ed1c078f35269b5c788a33cf'),
];

const wallets = [
  Wallet.fromPrivateKey(privateKeys[0]).getChecksumAddressString(),
  Wallet.fromPrivateKey(privateKeys[1]).getChecksumAddressString(),
  Wallet.fromPrivateKey(privateKeys[2]).getChecksumAddressString(),
  Wallet.fromPrivateKey(privateKeys[3]).getChecksumAddressString(),
  Wallet.fromPrivateKey(privateKeys[4]).getChecksumAddressString(),
];

function addressToBytes32 (value) {
  return `0x${'0'.repeat(64 - value.length)}${value}`;
}

function encodeParam (dataType, data) {
  const encode = web3.eth.abi.encodeParameter(dataType, data).slice(2);
  return encode;
}

const buildCreate2Address = function (saltHex, byteCode, deployerAddress) {
  return web3.utils.toChecksumAddress(`0x${web3.utils.sha3(`0x${[
    'ff',
    deployerAddress,
    addressToBytes32(saltHex),
    web3.utils.soliditySha3(byteCode),
  ].map(x => x.replace(/0x/, '')).join('')}`).slice(-40)}`);
};

const signHash = function (hash, privateKey) {
  const signature = ethereumUtil.ecsign(
    ethereumUtil.toBuffer(hash),
    ethereumUtil.toBuffer(privateKey)
  );
  return ethereumUtil.bufferToHex(Buffer.concat([signature.r, signature.s, ethereumUtil.toBuffer(signature.v)]));
};

const encodeData = function (
  to,
  value,
  data,
  minGasLimit,
  maxGasPrice,
  salt,
) {
  return web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes', 'uint256', 'uint256', 'bytes32'],
    [to, value, data, minGasLimit.toString(), maxGasPrice.toString(), salt]
  );
};

const getId = function (wallet, implementation, data) {
  return web3.utils.soliditySha3(
    { t: 'address', v: wallet },
    { t: 'address', v: implementation },
    { t: 'bytes32',
      v:
        web3.utils.soliditySha3(
          { t: 'bytes', v: data }
        ),
    }
  );
};

Object.assign(exports, {
  signHash,
  encodeData,
  getId,
  buildCreate2Address,
  encodeParam,
  privateKeys,
  wallets,
});
