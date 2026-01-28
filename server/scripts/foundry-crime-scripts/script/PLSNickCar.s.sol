// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface INickCar {
    // Try the nick() function - selector 0x26bbbd98
    function nick() external;
}

contract PLSNickCar is Script {
    // PLS Mainnet Nick Car contract address
    address constant PLS_NICK_CAR_CA = 0x2bf1EEaa4e1D7502AeF7f5beCCf64356eDb4a8c8;

    function run() external {
        nick();
    }

    function nick() public {
        vm.startBroadcast();
        INickCar nickCarContract = INickCar(PLS_NICK_CAR_CA);
        nickCarContract.nick();
        vm.stopBroadcast();
    }
}
