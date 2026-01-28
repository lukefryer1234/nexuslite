// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface ICrime {
    function makeCrime(uint8 crimeType) external;
}

contract PLSCrime is Script {
    // PLS Mainnet Crime contract address
    address constant PLS_CRIME_CA = 0xf077d4d0508505c5a80249aFC10bc6Ead90E47F1;

    function run(uint8 crimeType) external {
        crime(crimeType);
    }

    function crime(uint8 crimeType) public {
        // Start broadcast
        vm.startBroadcast();

        // Create an instance of the contract
        ICrime crimeContract = ICrime(PLS_CRIME_CA);

        // Call the trainSkill function
        crimeContract.makeCrime(crimeType);

        // Stop broadcast
        vm.stopBroadcast();
    }
}
