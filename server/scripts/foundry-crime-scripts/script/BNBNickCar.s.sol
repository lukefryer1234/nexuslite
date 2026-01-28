// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface INickCar {
    // Try the nick() function - selector 0x26bbbd98
    function nick() external;
}

contract BNBNickCar is Script {
    // BNB Mainnet Nick Car contract address
    address constant BNB_NICK_CAR_CA = 0x60B8e0dd9566b42F9CAa5538350aA0D29988373c;

    function run() external {
        nick();
    }

    function nick() public {
        vm.startBroadcast();
        INickCar nickCarContract = INickCar(BNB_NICK_CAR_CA);
        nickCarContract.nick();
        vm.stopBroadcast();
    }
}
