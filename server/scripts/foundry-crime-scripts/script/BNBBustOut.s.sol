// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface IBustOut {
    function bustOut() external;
}

contract BNBBustOut is Script {
    // BNB Mainnet BustOut contract address
    address constant BNB_BUST_OUT_CA = 0xd401B2af85Df998faaDD0963F0e15e2EB92D5697;

    function run() external {
        bustOut();
    }

    function bustOut() public {
        // Start broadcast
        vm.startBroadcast();

        // Create an instance of the contract
        IBustOut bustOutContract = IBustOut(BNB_BUST_OUT_CA);

        // Call the bustOut function
        bustOutContract.bustOut();

        // Stop broadcast
        vm.stopBroadcast();
    }
}
