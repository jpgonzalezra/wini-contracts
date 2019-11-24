const ethereumUtil = require('ethereumjs-util');

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
});
