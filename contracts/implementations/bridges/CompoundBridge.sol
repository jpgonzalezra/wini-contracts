pragma solidity 0.5.10;

import "./../../Wallet.sol";
import "./../../interfaces/ICErc20.sol";
import "./../../common/Relayable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract CompoundBridge is Relayable, ReentrancyGuard {
    
    using SafeMath for uint;
 
    IERC20 public token;
    ICErc20 public cToken;
    
    event Mint(address indexed _sender, uint256 _value);
    event Redeem(address indexed _sender, uint256 _value);
    
    constructor (
        address _tokenAddress,
        address _cTokenAddress,
        address _relayer
    ) Relayable(_relayer) public {
        cToken = ICErc20(_cTokenAddress);
        token = IERC20(_tokenAddress);
        require(cToken.isCToken());
        require(cToken.underlying() == _tokenAddress, "the underlying are different");
        
        token.approve(address(cToken), uint256(-1));
    }
    
    function mint(
        uint256 _value, 
        uint256 _fee, 
        bytes calldata _signature
    ) nonReentrant onlyRelayer external {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _value,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "Invalid signature");
    
        require(token.transferFrom(msg.sender, getRelayer(), _fee), "the transferFrom method to relayer failed");
        require(token.transferFrom(msg.sender, address(this), _value), "Pull token failed");

        uint preMintBalance = cToken.balanceOf(address(this));
        require(cToken.mint(_value) == 0, "underlying mint failed");
        uint postMintBalance = cToken.balanceOf(address(this));

        uint mintedTokens = postMintBalance.sub(preMintBalance);
        require(cToken.transfer(msg.sender, mintedTokens), "The transfer method failed");
        
        emit Mint(msg.sender, mintedTokens);

    }
    
    function redeem(
        uint256 _value, 
        uint256 _fee, 
        bytes calldata _signature
    ) nonReentrant onlyRelayer external {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _value,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "Invalid signature");
        
        require(token.transferFrom(msg.sender, getRelayer(), _fee));
        
        require(cToken.transferFrom(msg.sender, address(this), _value), "Pull token failed");
        uint preDaiBalance = token.balanceOf(address(this));
        require(cToken.redeem(_value) == 0, "Underlying redeeming failed");
        uint postDaiBalance = token.balanceOf(address(this));

        uint redeemedDai = postDaiBalance.sub(preDaiBalance);

        token.transfer(msg.sender, redeemedDai);
        
        emit Redeem(msg.sender, redeemedDai);
    }
     
}