// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface INickCar {
    function nickCar() external;
}

contract BNBNickCar is Script {
    // BNB Mainnet Nick Car contract address
    address constant BNB_NICK_CAR_CA = 0x60B8e0dd9566b42F9CAa5538350aA0D29988373c;

    function run() external {
        nickCar();
    }

    function nickCar() public {
        vm.startBroadcast();
        INickCar nickCarContract = INickCar(BNB_NICK_CAR_CA);
        nickCarContract.nickCar();
        vm.stopBroadcast();
    }
}
