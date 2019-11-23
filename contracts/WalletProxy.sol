pragma solidity 0.5.10;

import "./Proxy.sol";

/// @title WalletProxy
contract WalletProxy {

    /// @notice calculate wallet contract byteCode for Create2
    /// @param _source signer address
    /// @return bytecode proxy with wallet contract source
    function getInitCode(address _source) public pure returns (bytes memory)  {
        bytes memory args = new bytes(32);
        // solhint-disable-next-line no-inline-assembly
        assembly { mstore(add(args, 0x20), _source) }
        // creation bytecode of the contract more _source
        return calculateInitcode(args);
    }

    function calculateInitcode(bytes memory args) internal pure returns (bytes memory) {
        // Memory byte array that contains the creation bytecode of the contract.
        bytes memory code = type(Proxy).creationCode;

        uint256 codeLength = code.length;
        uint256 argsLength = args.length;
        bytes memory initCode = new bytes(argsLength + codeLength);

        uint256 codePtr;
        uint256 argsPtr;
        uint256 initCodePtr;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            codePtr := add(code, 0x20)
            argsPtr := add(args, 0x20)
            initCodePtr := add(initCode, 0x20)
        }

        memcpy(initCodePtr, codePtr, codeLength);
        memcpy(initCodePtr + codeLength, argsPtr, argsLength);

        return initCode;
    }

    /// From: https://github.com/Arachnid/solidity-stringutils/blob/master/src/strings.sol
    function memcpy(uint256 dest, uint256 src, uint256 len) private pure {
        // Copy word-length chunks while possible
        for (; len >= 32; len -= 32) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - len) - 1;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }

}
