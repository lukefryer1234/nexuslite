// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface IBustOut {
    function bustOut() external;
}

contract PLSBustOut is Script {
    // PLS Mainnet BustOut contract address
    address constant PLS_BUST_OUT_CA = 0xf404b3336f5D78406326e848c8bc14Cbf2566d0A;

    function run() external {
        bustOut();
    }

    function bustOut() public {
        // Start broadcast
        vm.startBroadcast();

        // Create an instance of the contract
        IBustOut bustOutContract = IBustOut(PLS_BUST_OUT_CA);

        // Call the bustOut function
        bustOutContract.bustOut();

        // Stop broadcast
        vm.stopBroadcast();
    }
}
