// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract SubscriptionManager {
    uint256 public constant PRICE_USD = 5 * 10**18; // 5 cUSD (18 decimals)
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;

    address public paymentToken;

    event Subscribed(address indexed wallet, uint256 amount, uint256 expiry);
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);

    mapping(address => uint256) public expiries;

    constructor(address _paymentToken) {
        paymentToken = _paymentToken;
    }

    function subscribe() external {
        require(
            IERC20(paymentToken).transferFrom(msg.sender, address(this), PRICE_USD),
            "Transfer failed"
        );
        uint256 expiry = block.timestamp + SUBSCRIPTION_DURATION;
        if (expiries[msg.sender] > block.timestamp) {
            expiry = expiries[msg.sender] + SUBSCRIPTION_DURATION;
        }
        expiries[msg.sender] = expiry;
        emit Subscribed(msg.sender, PRICE_USD, expiry);
    }

    function isSubscribed(address wallet) external view returns (bool) {
        return expiries[wallet] > block.timestamp;
    }

    function getExpiry(address wallet) external view returns (uint256) {
        return expiries[wallet];
    }

    function withdraw() external {
        uint256 balance = IERC20(paymentToken).balanceOf(address(this));
        require(balance > 0, "No balance");
        IERC20(paymentToken).transfer(msg.sender, balance);
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
