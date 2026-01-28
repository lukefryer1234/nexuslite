// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface ICrime {
    function makeCrime(uint8 crimeType) external;
}

contract BNBCrime is Script {
    // BNB Mainnet Crime contract address
    address constant BNB_CRIME_CA = 0x167ad284C7bcc4d6342991Aa258422E7a04f926E;

    function run(uint8 crimeType) external {
        crime(crimeType);
    }

    function crime(uint8 crimeType) public {
        // Start broadcast
        vm.startBroadcast();

        // Create an instance of the contract
        ICrime crimeContract = ICrime(BNB_CRIME_CA);

        // Call the trainSkill function
        crimeContract.makeCrime(crimeType);

        // Stop broadcast
        vm.stopBroadcast();
    }
}
