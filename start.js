/*jslint node: true */
'use strict';
const constants = require('ocore/constants.js');
const conf = require('ocore/conf');
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');
const validationUtils = require('ocore/validation_utils');
const headlessWallet = require('headless-obyte');
const request = require('request');

let arrQueue = [];
const KEY_API = '50ace22603c84daba1780432180111';
let my_address;

eventBus.once('headless_wallet_ready', () => {
	headlessWallet.setupChatEventHandlers();
	
	/**
	 * user pairs his device with the bot
	 */
	eventBus.on('paired', (from_address, pairing_secret) => {
		// send a geeting message
		const device = require('ocore/device.js');
		device.sendMessageToDevice(from_address, 'text', "Welcome to my new shiny bot!");
	});
	
	headlessWallet.readSingleAddress(address => {
		my_address = address;
		console.error('my_address', address)
	});
	
	eventBus.on('text', (from_address, text) => {
		text = text.trim();
		const device = require('ocore/device.js');
		const args = text.toLowerCase().split(':');
		if (args.length === 2){
			switch (args[0]) {
				case 'berlin':
				case 'moscow':
				case 'helsinki':
				case 'washington':
					if(parseInt(args[1]) <= Date.now()){
						console.error('dateNow', Date.now());
						device.sendMessageToDevice(from_address, 'text', "Incorrect time");
					}else {
						arrQueue.push({city: args[0], time: args[1], device_address: from_address});
						device.sendMessageToDevice(from_address, 'text', "ok");
					}
					break;
				default:
					device.sendMessageToDevice(from_address, 'text', "City not support");
					break;
			}
		}else {
			device.sendMessageToDevice(from_address, 'text', "Incorrect command");
		}
	});

});

function checkQueue(){
	arrQueue.forEach((el, index) => {
		if(el.time <= Date.now()){
			request('https://api.apixu.com/v1/current.json?key='+ KEY_API+'&q=' + el.city, function (error, response, body) {
				if(error){
					console.error(error);
				} else {
					let result = JSON.parse(body);
					postDataFeed(el.city, el.time, result.current.temp_c);
					arrQueue.splice(index, 1);
				}
			});
		}
	});
}
setInterval(checkQueue, 60000);

function postDataFeed(city, time, temp){
	const network = require('ocore/network.js');
	const composer = require('ocore/composer.js');
	const objectHash = require('ocore/object_hash.js');
	
	let data_feed = {};
	data_feed[city + '_' + time] = temp;
	let params = {
		paying_addresses: [my_address],
		outputs: [{address: my_address, amount: 0}],
		signer: headlessWallet.signer,
		callbacks: composer.getSavingCallbacks({
			ifNotEnoughFunds: console.error,
			ifError: console.error,
			ifOk: function(objJoint){
				network.broadcastJoint(objJoint);
			}
		})
	};
	let objMessage = {
		app: "data_feed",
		payload_location: "inline",
		payload_hash: objectHash.getBase64Hash(data_feed),
		payload: data_feed
	};
	params.messages = [objMessage];
	composer.composeJoint(params);
}


/**
 * user pays to the bot
 */
eventBus.on('new_my_transactions', (arrUnits) => {
	// handle new unconfirmed payments
	// and notify user
	
//	const device = require('ocore/device.js');
//	device.sendMessageToDevice(device_address_determined_by_analyzing_the_payment, 'text', "Received your payment");
});

/**
 * payment is confirmed
 */
eventBus.on('my_transactions_became_stable', (arrUnits) => {
	// handle payments becoming confirmed
	// and notify user
	
//	const device = require('ocore/device.js');
//	device.sendMessageToDevice(device_address_determined_by_analyzing_the_payment, 'text', "Your payment is confirmed");
});



process.on('unhandledRejection', up => { throw up; });
