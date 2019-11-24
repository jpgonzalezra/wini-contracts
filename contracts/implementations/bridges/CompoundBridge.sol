pragma solidity 0.5.10;

import "./../../Wallet.sol";
import "./../../interfaces/ICErc20.sol";
import "./../../common/ReceiptERC20Fee.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @dev  * Bridge beetwen wini-contracts and compound.
///       * charges the end user for gas costs in an application-specific ERC20 token
contract CompoundBridge is ReceiptERC20Fee, ReentrancyGuard {

    using SafeMath for uint;

    ICErc20 public cToken;

    event Mint(address indexed _sender, uint256 _value);
    event Redeem(address indexed _sender, uint256 _value);

    constructor (
        address _tokenAddress,
        address _cTokenAddress,
        address _collector
    ) public ReceiptERC20Fee(_tokenAddress, _collector) {
        cToken = ICErc20(_cTokenAddress);
        require(cToken.isCToken());
        require(cToken.underlying() == _tokenAddress, "CompoundBridge/underlying-different");

        token.approve(address(cToken), uint256(-1));
    }

    function mint(
        uint256 _value,
        uint256 _fee,
        bytes calldata _signature
    ) external nonReentrant {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _value,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "CompoundBridge/invalid-signature");

        transferFee(_fee);
        require(token.transferFrom(msg.sender, address(this), _value), "CompoundBridge/pull-token-failed");

        uint preMintBalance = cToken.balanceOf(address(this));
        require(cToken.mint(_value) == 0, "CompoundBridge/underlying-mint-failed");
        uint postMintBalance = cToken.balanceOf(address(this));

        uint mintedTokens = postMintBalance.sub(preMintBalance);
        require(cToken.transfer(msg.sender, mintedTokens), "CompoundBridge/transfer-failed");

        emit Mint(msg.sender, mintedTokens);

    }

    function redeem(
        uint256 _value,
        uint256 _fee,
        bytes calldata _signature
    ) external nonReentrant {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _value,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "CompoundBridge/invalid-signature");

        transferFee(_fee);
        require(cToken.transferFrom(msg.sender, address(this), _value), "CompoundBridge/pull-token-failed");

        uint preDaiBalance = token.balanceOf(address(this));
        require(cToken.redeem(_value) == 0, "CompoundBridge/underlying-redeeming-failed");
        uint postDaiBalance = token.balanceOf(address(this));

        uint redeemedDai = postDaiBalance.sub(preDaiBalance);

        token.transfer(msg.sender, redeemedDai);

        emit Redeem(msg.sender, redeemedDai);
    }

}
