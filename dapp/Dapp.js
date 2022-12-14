

import providers from "../data/networks/Providers.json" assert {type: "json"};

import deployedContracts from "../data/networks/DeployedContracts.json" assert {type: "json"};

import Web3 from "web3";

import fs from "fs";

import bip39 from "bip39";

import HDKey from "hdkey";

import * as Block from 'multiformats/block';

import * as json from 'multiformats/codecs/json';

import { sha256 } from 'multiformats/hashes/sha2';

import promptImport from "prompt-sync";

import DonationDapp from "../data/contracts/DonationDapp.json" assert {type: "json"}

import contract from "@truffle/contract";

import { execSync } from 'child_process';

import { create } from 'ipfs-http-client';

let donationDapp = contract(DonationDapp);

let mnemonic = fs.readFileSync("./data/mnemonic/.secret").toString()

let prompt;

let args

let web3;

let network;

let utils = Web3.utils;

let wallet;

let account;

let sDapp;

let ipfs;

const dapp = async () =>{

    prompt = await promptImport();

    args = process.argv;

    //console.log(args)

    if(args.length < 4)
    {
        console.log('\x1b[31m%s\x1b[0m', `Invalid Number of Arguments Given to Dapp.`)
        process.exit(1);
    }

    console.log("Enter password to access distributor account.")
    let password = (prompt("Password: ", {echo: "*"})).toString();

    try{
        mnemonic = (execSync(`node ./data/mnemonic/MnemonicManager.js decrypt "${mnemonic}" "${password}"`)).toString().trim()//(execSync("node ./data/mnemonic/MnemonicManager.js encrypt")).toString()//
    }
    catch{
        console.log('\x1b[31m%s\x1b[0m', "Mnemonic retreival error.")
        process.exit(1);
    }
   
    //console.log(`"${mnemonic}"`)
    
    while(network === undefined){
        switch(args[2]){
            case "Ganache": web3 = new Web3(providers["Ganache"].url); break;
            case "Goerli" : web3 = new Web3(providers["Goerli"].url); break;
            case "Ethereum" : web3 = new Web3(providers["Ethereum"].url); break;
            default: break;
        }
        try{
            let chainid = await web3.eth.getChainId();
            console.log('\x1b[32m%s\x1b[0m', `Chain ID: ${chainid}`)
            network = args[2];
        }catch{
            console.log('\x1b[31m%s\x1b[0m', `Error Connecting to network: ${args[2]}`)
            let response = prompt("Retry connection? Y/n: ")
            if(response !== "Y"){
                process.exit(1)
            }
        }
    }

    

    await initWallet();

    await initDonationDapp();

    ipfs = await create(); //await initIPFS();

    console.log(await ipfs.version());

    switch(args[3]){
        case "Deploy" : await deploy(); break;
        case "Distribute" : await distribute(); break;
        case "Balance" : await balance(); break;
        case "Content" : await content(); break;
        case "Claim" : await claim(); break;
        case "Metadata" : await metadata(); break;
        case "Account": break;
        default: break;
    }
   
    process.exit(1);
}

const metadata = async (  ) =>{
    let metadata = JSON.parse(fs.readFileSync("./dapp/metadata/" + network + "/Metadata.json"));
    console.log('\x1b[32m%s\x1b[0m', `Metadata \n${JSON.stringify(metadata, null, 4)}`)
    let block = await Block.encode({value: metadata, codec: json, hasher: sha256})
    console.log(block)
    let cid = await ipfs.block.put( block.bytes, {version: 1, format: "json", mhtype: 'sha2-256'} )
    console.log(cid)
    cid = await ipfs.pin.add(cid)
    console.log(cid)
}

const claim = async () =>{

    try{
        await balance();
        let response = prompt("Would you like to claim? Y/n: ");

        if(response !== "Y"){
            console.log('\x1b[31m%s\x1b[0m', "Canceled Dapp Claim.")
            return
        }

        await sDapp.claim({from: account.address});

        console.log('\x1b[32m%s\x1b[0m', "Claimed Contract Balance.")

    }catch{
        console.log('\x1b[31m%s\x1b[0m', "Unexplected Claim Error.")
    }

}

const content = async () =>{

    try{
        let contentCID = args[4];

        console.log(`Provided content cid: ${contentCID}`);

        let response = prompt("Would you like to proceed in setting content? Y/n: ")
        if(response !== "Y"){
            console.log('\x1b[31m%s\x1b[0m', "Canceled Set Content.")
            return
        }

        await sDapp.setContentCID(contentCID, {from: account.address})
    }
    catch{

    }

}

const balance = async () =>{
    try{
        let balance = utils.fromWei(await web3.eth.getBalance(sDapp.address))

        console.log('\x1b[32m%s\x1b[0m', `Contract Balance: ${balance}`)

    }catch{
        console.log('\x1b[31m%s\x1b[0m', "Unexplected Balance Error.")
    }
}

const distribute = async () =>{
    try{
        let metadata = JSON.parse(fs.readFileSync("./dapp/metadata/" + network + "/Metadata.json"))

        if(metadata.contract !== undefined && metadata.contract !== sDapp.address){
            let response = prompt(`The base metadata contract was not undefined: ${metadata.contract}. Would you like to overwrite metadata? Y/n: `);
            if(response !== "Y"){
                console.log('\x1b[31m%s\x1b[0m', "Canceled Dapp Distribution.")
                return
            }
        }

        let release = execSync(`lsb_release -a`);

        let os = release.toString().split("Description:")[1].split("Release:")[0].trim();

        let node = (execSync('node -v')).toString().trim()

        metadata.build_environment = {os, node}
        
        //console.log(metadata.build_environment)
    
        metadata.network = network;

        metadata.chainid = providers[network]["network_id"];
    
        metadata.contract = sDapp.address;
    
        metadata.distributor = account.address;
    
        let message = `${metadata.dapp}-${metadata.build}-${metadata.network}-${metadata.chainid}-${metadata.build_environment.os}-${metadata.build_environment.node}-${metadata.contract}-${metadata.distributor}`
    
        let sig = await account.sign(message)
    
        metadata.signature = sig;
    
        let block = await Block.encode({value: metadata, codec: json, hasher: sha256})
    
        console.log(block.cid.toString())
    
        let gas = await sDapp.distributeDapp.estimateGas(block.cid.toString(), {from: account.address})
    
        let gasPrice = await web3.eth.getGasPrice();
    
        let totalEther = utils.fromWei((gas * gasPrice).toString())
    
        console.log(`Dapp distribution cost: ${totalEther}`)
    
        let response = prompt("Would you like to proceed with distribution? Y/n: ");
    
        if(response !== "Y"){
            console.log('\x1b[31m%s\x1b[0m', "Canceled Dapp Distribution.")
            return
        }
    
        await sDapp.distributeDapp(block.cid.toString(), {from: account.address})
    
        let dappCID = await sDapp.DappCID()
    
        console.log(metadata)
        console.log(dappCID)

        fs.writeFileSync("./dapp/metadata/" + network + "/Metadata.json", JSON.stringify(metadata, null, 4));
    }catch(e){
        console.log('\x1b[31m%s\x1b[0m', "Unexpected Distribution Error. " + e)
    }
}

const deploy = async () =>{
    try{
        if(deployedContracts[network] !== undefined){
            let response = prompt(`Would you like to overwrite the contract ${deployedContracts[network]} for ${network} network Y/n ? `)
    
            if(response !== "Y"){
                console.log('\x1b[31m%s\x1b[0m', "Canceled Deployment.")
                return
            }
        }
    
        let contentTime = Date.now() + (365 * ((24 * 60) * 60) * 1000) 
    
        let gas = await donationDapp.new.estimateGas(utils.toWei("0.034"), 10000, contentTime)
    
        //console.log(gas)
    
        let gasPrice = await web3.eth.getGasPrice()
    
        let totalEther = utils.fromWei((gas * gasPrice).toString())
        gasPrice = utils.fromWei(gasPrice, "gwei")
        if(gasPrice > 30){
            console.log('\x1b[31m%s\x1b[0m', `Gas price of ${gasPrice} is to high for deployment.`)
            return
        }
    
        console.log('\x1b[32m%s\x1b[0m', `gas estimate: ${gas}, gas price in gwei: ${gasPrice}, total cost estimate: ${totalEther} `)
    
        let response = prompt("Would you like to continue deployment? Y/n: ")
    
        if(response !== "Y"){
            console.log('\x1b[31m%s\x1b[0m', "Canceled Deployment.")
            return
        }
    
        let donation = utils.toWei("0.034", "ether")

        console.log(donation)
    
        sDapp = await donationDapp.new(donation, 10000, contentTime, {from: account.address});
    
        console.log(`deployed address: ${sDapp.address}`)
    
        deployedContracts[network] = sDapp.address;
        
        fs.writeFileSync("./data/networks/DeployedContracts.json", JSON.stringify(deployedContracts, null, 4))
    
        fs.writeFileSync("./webpage/src/data/networks/DeployedContracts.json", JSON.stringify(deployedContracts, null, 4))
    }catch(e){
        console.log('\x1b[31m%s\x1b[0m', "Unexpected Deployment Error.", e.reason)
    }
}

const initDonationDapp = async () =>{

    donationDapp.setProvider(web3.eth.currentProvider);
    donationDapp.setWallet(wallet)

    if(deployedContracts[network] === undefined){
        console.log('\x1b[33m%s\x1b[0m', `There was not a deployed contract for ${network}`)
        return;
    }

    sDapp = await donationDapp.at(deployedContracts[network])

}

const initWallet = async () => {
    if(!bip39.validateMnemonic(mnemonic)){
        
        console.log('\x1b[31m%s\x1b[0m', "Invalid mnemonic given decrypt to execute dapp methods.");
        process.exit(1)
    }
    let seed = bip39.mnemonicToSeedSync(mnemonic);
    let hdkey = HDKey.fromMasterSeed(seed);

    let key = hdkey.derive("m/44'/60'/0'/0/0");
    let privateKey = "0x" + key.privateKey.toString('hex')
    await web3.eth.accounts.wallet.add(privateKey);

    wallet = web3.eth.accounts.wallet;
  
    account = wallet[0]

    let balance = utils.fromWei((await web3.eth.getBalance(account.address)).toString(), "ether");

    console.log(`Account Address: ${account.address}, Balance: ${balance}`);
}

dapp();