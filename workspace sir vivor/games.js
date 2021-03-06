/**
 * Games
 * BotStuff - https://github.com/CheeseMuffin/BotStuff
 *
 * This file contains the game system and related commands for BotStuff.
 *
 * @license MIT license
 */

'use strict';

const fs = require('fs');

class Player {
	constructor(user) {
		this.name = user.name;
		this.id = user.id;
		this.eliminated = false;
	}

	say(message) {
	    Users.add(this.id).say(message);
	}
}

class Game {
	constructor(room) {
		this.room = room;
		this.players = {};
		this.playerCount = 0;
		this.round = 0;
		this.started = false;
		this.ended = false;
		this.freeJoin = false;
		this.playerCap = -1;
		this.minigame = false;
		this.canLateJoin = false;
		this.canRejoin = false;
		this.winners = new Map();
		this.parentGame = null;
		this.childGame = null;
		this.golf = false;
	}

	mailbreak() {
		Parse.say(this.room, '/w lady monita, .mail Moo, A game of ' + this.name + ' broke in progress!');
	}

	say(message) {
	    Parse.say(this.room, message);
	}

	html(message) {
		this.room.html(message);
	}

	signups() {
		console.log(this);
		this.say("survgame! If you would like to play, use the command ``/me in``");
		if (this.description) this.say("**" + (this.golf ? "Golf " : "") + this.name + "**:" + this.description);
		if (typeof this.onSignups === 'function') this.onSignups();
		if (this.freeJoin) this.started = true;
		this.timeout = setTimeout(() => this.start(), 5 * 60 * 1000);
	}

	getPlayerNames(players) {
		if (!players) players = this.players;
		let names = [];
		for (let i in players) {
			names.push(players[i].name);
		}
		return names.join(", ");
	}

	start() {
		if (this.started) return;
		if (this.playerCount < 1) {
			this.say("The game needs at least two players to start!");
			return;
		}
		this.started = true;
		if (typeof this.onStart === 'function') this.onStart();
	}

	autostart(target) {
		let x = Math.floor(target);
		if (!x || x > 120 || (x < 10 && x > 2) || x <= 0) return;
		if (x < 10) x *= 60;
		let minutes = Math.floor(x / 60);
		let seconds = x % 60;
		this.say("The game will automatically start in " + (minutes > 0 ? ((minutes) + " minute" + (minutes > 1 ? "s" : "")) + (seconds > 0 ? " and " : "") : "") + (seconds > 0 ? ((seconds) + " second" + (seconds > 1 ? "s" : "")) : "") + ".");
		this.timeout = setTimeout(() => this.start(), x * 1000);
	}

	cap(target) {
		let x = Math.floor(target);
		if (!x || x < 2) return;
		this.playerCap = x;
		if (this.playerCount >= x) {
			this.start();
		} else {
			this.say("The game will automatically start with " + x + " players!");
		}
	}

	end() {
		if (this.getRemainingPlayerCount() === 1) {
			let winPlayer = this.getLastPlayer();
			this.say("**Winner:** " + winPlayer.name);
		}
		if (this.ended) return;
		if (this.timeout) clearTimeout(this.timeout);
		if (typeof this.onEnd === 'function') this.onEnd();
		this.ended = true;
		this.room.game = null;
	}

	forceEnd() {
		if (this.ended) return;
		if (this.timeout) {
			clearTimeout(this.timeout);
		}
		this.say("The game was forcibly ended.");
		this.ended = true;
		this.room.game = null;
	}

	nextRound() {
		if (this.timeout) clearTimeout(this.timeout);
		this.round++;
		if (this.getRemainingPlayerCount() < 2) {
			this.end();
			return;
		}
		if (typeof this.onNextRound === 'function') this.onNextRound();
	}

	addPlayer(user) {
		if (user.id in this.players) return;
		let player = new Player(user);
		this.players[user.id] = player;
		this.playerCount++;
		if (this.playerCount === this.playerCap) {
			this.start();
		}
		return player;
	}

	removePlayer(user) {
		if (!(user.id in this.players) || this.players[user.id].eliminated) return;
		if (this.started) {
			this.players[user.id].eliminated = true;
		} else {
			delete this.players[user.id];
			this.playerCount--;
		}
	}

	renamePlayer(user, oldName) {
		let oldId = Tools.toId(oldName);
		if (!(oldId in this.players)) return;
		let player = this.players[oldId];
		player.name = user.name;
		if (player.id === user.id || user.id in this.players) return;
		player.id = user.id;
		this.players[user.id] = player;
		delete this.players[oldId];
		if (this.onRename) this.onRename(user);
	}

	join(user) {
		if (this.started && !this.canLateJoin) return;
		if (user.id in this.players && !this.canRejoin) return;
		if (this.freeJoin) {
			user.say("This game does not require you to join!");
			return;
		}
		if (user.id in this.players) {
			let player = this.players[user.id];
			if (!player.eliminated) return;
			user.say("You have rejoined the game of " + this.name + "!");
			player.eliminated = false;
			this.players[user.id] = player;
		} else {
			this.addPlayer(user);
			if (!this.started) user.say('You have joined the game of ' + this.name + '!');
		}
		if (typeof this.onJoin === 'function') this.onJoin(user);
	}

	leave(user) {
		if (!(user.id in this.players) || this.players[user.id].eliminated) return;
		this.removePlayer(user);
		user.say("You have left the game of " + this.name + "!");
		if (typeof this.onLeave === 'function') this.onLeave(user);
	}

	getRemainingPlayers() {
		let remainingPlayers = {};
		for (let i in this.players) {
			if (!this.players[i].eliminated) remainingPlayers[i] = this.players[i];
		}
		return remainingPlayers;
	}

	getRandomOrdering() {
		let remainPlayers = this.getRemainingPlayers();
		let order = Tools.shuffle(Object.keys(remainPlayers));
		let realOrder = [];
		for (let i = 0; i < order.length; i++) {
			realOrder.push(remainPlayers[order[i]]);
		}
		return realOrder;
	}

	getLastPlayer() {
		let remainingPlayers = this.getRemainingPlayers();
		return remainingPlayers[Object.keys(remainingPlayers)[0]];
	}

	getRemainingPlayerCount() {
		let count = 0;
		for (let i in this.players) {
			if (!this.players[i].eliminated) count++;
		}
		return count;
	}

	shufflePlayers(players) {
		if (!players) players = this.players;
		let list = [];
		for (let i in players) {
			list.push(players[i]);
		}
		return Tools.shuffle(list);
	}

	pl() {
		let players = [];
		for (let userID in this.players) {
			if (this.players[userID].eliminated) continue;
			players.push(this.players[userID].name);
		}
		this.say("**Players (" + this.getRemainingPlayerCount() + ")**: " + players.join(", "));
	}

	sayPlayerRolls() {
		this.rolla = null;
		this.rollb = null;
		if (this.roll1 && this.roll2) {
			this.say("!roll " + this.roll1);
			this.say("!roll " + this.roll2);
		}
	}

	handleRoll(roll) { 
		if (!this.rolla) this.rolla = roll;
		else {
			this.rollb = roll;
			if (this.rolla === this.rollb) {
				this.say("The rolls were the same. Rerolling...");
				this.timeout = setTimeout(() => this.sayPlayerRolls(), 5 * 1000);
			} else {
				let winPlayer, losePlayer;
				if (this.rolla > this.rollb && (!this.golf) || (this.rolla < this.rollb && this.golf)) {
					winPlayer = this.curPlayer;
					losePlayer = this.oplayer;
				} else {
					winPlayer = this.oplayer;
					losePlayer = this.curPlayer;
				}
				if (typeof this.handleWinner === 'function') this.handleWinner(winPlayer, losePlayer);
			}
		}
	}
	handlehtml(message) {
		if (!this.started) return;
		console.log(message);
		//try {
			message = message.substr(21);
			if (message.substr(0, 4) === "Roll") {
				let colonIndex = message.indexOf(":");
				message = message.substr(colonIndex + 2);
				message = message.substr(0, message.length - 6);
				if (typeof this.handleRoll === 'function') this.handleRoll(Math.floor(message));
			} else if (message.substr(4, 2) === "We") {
				let colonIndex = message.indexOf(":");
				message = message.substr(colonIndex + 7);
				message = message.substr(0, message.length - 6);
				while (message.indexOf('&') !== -1) {
					console.log(message.substr(0, message.indexOf('&')));
					console.log(message.substr(message.indexOf(';')) + 1);
					console.log(message.substr(0, message.indexOf('&')) + message.substr(message.indexOf(';')) + 1);
					message = message.substr(0, message.indexOf('&')) + message.substr(message.indexOf(';') + 1);
				}
				console.log(message);
				if (typeof this.handlePick === 'function') this.handlePick(message);
			} else {
				if (message.indexOf("rolls") !== -1) {
					let colonIndex = message.indexOf(":");
					message = message.substr(colonIndex + 2);
					let finalIndex = message.indexOf("<");
					message = message.substr(0, finalIndex);
					let rolls = [];
					message = message.split(", ");
					for (let i = 0; i < message.length; i++) {
						rolls.push(Math.floor(message[i]));
					}
					if (typeof this.handleRolls === 'function') this.handleRolls(rolls);
				}
			}
		//} catch (e) {
			//this.say("I'm sorry, the game broke. Moo has been notified and will fix it as soon as he can.");
			//console.log(e);
			//this.end();
			//return;
		//}
	}
}

class GamesManager {
	constructor() {
		this.games = {};
		this.modes = {};
		this.aliases = {};
		this.commands = {};
		this.aliases = {};
		this.fileMap = {};
		this.host = null;
		this.hosts = [];
		this.canTheme = true;
		this.canIntro = true;
		this.canQueue = true;
		this.isTimer = false;
		this.points = null;
		this.excepted = [];
		this.numHosts = {};
		this.destroyMsg = [
			"annihilates",
			"beats up",
			"reks",
			"destroys",
			"demolishes",
			"decimates",
		];
		this.lastGame = null;
		
	}

	importHosts() {
		try {
			this.numHosts = JSON.parse(fs.readFileSync('./databases/hosts.json'));
			console.log(this.numHosts);
		} catch (e) {};
	}

	exportHosts() {
		fs.writeFileSync('./databases/hosts.json', JSON.stringify(this.numHosts));
	}

	importHost() {
		let id = fs.readFileSync('./databases/host.json').toString();
		if (id) {
			console.log(id);
			Games.host = Users.get(id);
		}
		else Games.host = null;
		if (!Games.host) Games.host = null;
	}

	exportHost() {
		if (Games.host) {
			fs.writeFileSync('./databases/host.json', this.host.id);
		} else {
			fs.writeFileSync('./databases/host.json', '');
		}
	}
	addHost(user) {
		if (user.id) {
			user = user.id;
		}
		user = Tools.toId(user);
		let time = Math.floor(new Date().getTime() / 1000);
		if (user in this.numHosts) {
			this.numHosts[user].push(time);
		} else {
			this.numHosts[user] = [time];
		}
	}

	getHosts(user, days) {
		user = Tools.toId(user);
		let curTime = Math.floor(new Date().getTime() / 1000);
		if (!(user in this.numHosts)) {
			return ("**" + user + "** has never hosted.");
		} else {
			let time = days * 60 * 60 * 24;
			let hosts = this.numHosts[user];
			let numHosts = 0;
			for (let i in hosts) {
				let hostTime = hosts[i];
				if (Math.abs(curTime - hostTime) < time) {
					numHosts++;
				}
			}
			if (numHosts === 0) {
				return ("**" + user + "** has not hosted in the last " + days + " day" + (days > 1 ? "s" : "") + ".");
			} else {
				return ("**" + user + "** has hosted " + numHosts + " time" + (numHosts > 1 ? "s" : "") + " in the last " + days + " day" + (days > 1 ? "s" : "") + ".");
			}
		}
	}

	removeHost(user) {
		if (user.id) {
			user = user.id;
		}
		user = Tools.toId(user);
		if (!(user in this.numHosts)) return false;
		if (this.numHosts[user].length === 0) return false;
		this.numHosts[user].splice(this.numHosts[user].length - 1, 1);
		return true;
	}

	timer(room) {
	    Parse.say(room, "**Time's up!**");
		this.isTimer = false;
	}
	onLoad() {
		this.loadGames();
	}

	loadGame(fileName) {
		var path = process.cwd();
		delete require.cache[path + '\\games\\' + fileName];
		let file = require('./games/' + fileName);
		if (file.game && file.name && file.id) this.games[file.id] = file;
		this.aliases[file.name] = file.aliases;
	}

loadGames() {
		let games;
		try {
			games = fs.readdirSync('./games');
		} catch (e) {}
		if (!games) return;
		for (let i = 0, len = games.length; i < len; i++) {
			let game = games[i];
			if (!game.endsWith('.js')) continue;
			game = require('./games/' + game);
			this.games[game.id] = game;
		}

		let modes;
		try {
			modes = fs.readdirSync('./games/modes');
		} catch (e) {}
		if (modes) {
			for (let i = 0, len = modes.length; i < len; i++) {
				let mode = modes[i];
				if (!mode.endsWith('.js')) continue;
				mode = require('./games/modes/' + mode);
				this.modes[mode.id] = mode;
				if (mode.commands) {
					if (i in this.commands && this.commands[i] !== mode.commands[i]) throw new Error(mode.name + " command '" + i + "' is already used for a different game function (" + this.commands[i] + ").");
					for (let i in mode.commands) {
						if (i in Commands) {
							if (i in this.commands) continue;
							throw new Error(mode.name + " mode command '" + i + "' is already a command.");
						}
						let gameFunction = mode.commands[i];
						this.commands[i] = gameFunction;
						if (gameFunction in mode.commands && gameFunction !== i) {
							Commands[i] = gameFunction;
							continue;
						}
						Commands[i] = function (target, room, user, command, time) {
							if (room.game) {
								if (typeof room.game[gameFunction] === 'function') room.game[gameFunction](target, user, command, time);
							} else if (room === user) {
								user.rooms.forEach(function (value, room) {
									if (room.game && room.game.pmCommands && (room.game.pmCommands === true || i in room.game.pmCommands) && typeof room.game[gameFunction] === 'function') room.game[gameFunction](target, user, command, time);
								});
							}
						};
					}
				}
			}

			for (let i in this.modes) {
				let mode = this.modes[i];
				if (mode.aliases) {
					for (let i = 0, len = mode.aliases.length; i < len; i++) {
						let alias = Tools.toId(mode.aliases[i]);
						if (alias in this.modes) throw new Error(mode.name + " alias '" + alias + "' is already a mode.");
						this.modes[alias] = mode;
						mode.aliases[i] = alias;
					}
				}
			}
		}

		for (let i in this.games) {
			let game = this.games[i];
			if (game.inherits) {
				if (!game.install) throw new Error(game.name + " must have an install method to inherit from other games.");
				let parentId = Tools.toId(game.inherits);
				if (parentId === game.id || !(parentId in this.games)) throw new Error(game.name + " inherits from an invalid game.");
				if (!this.games[parentId].install) throw new Error(game.name + "'s parent game '" + game.inherits + "' must have an install method.");
				game.inherits = parentId;
			}
			if (game.commands) {
				for (let i in game.commands) {
					if (i in this.commands && this.commands[i] !== game.commands[i]) throw new Error(game.name + " command '" + i + "' is already used for a different game function (" + this.commands[i] + ").");
					if (i in Commands) {
						if (i in this.commands) continue;
						throw new Error(game.name + " command '" + i + "' is already a command.");
					}
					let gameFunction = game.commands[i];
					this.commands[i] = gameFunction;
					if (gameFunction in game.commands && gameFunction !== i) {
						Commands[i] = gameFunction;
						continue;
					}
					Commands[i] = function (target, room, user, command, time) {
						if (room.game) {
							if (typeof room.game[gameFunction] === 'function') room.game[gameFunction](target, user, command, time);
						} else if (room === user) {
							Rooms.rooms.forEach(function (value, room) {
								if (room.game && room.game.pmCommands && (room.game.pmCommands === true || i in room.game.pmCommands) && typeof room.game[gameFunction] === 'function') room.game[gameFunction](target, user, command, time);
							});
						}
					};
				}
			}
			if (game.aliases) {
				for (let i = 0, len = game.aliases.length; i < len; i++) {
					let alias = Tools.toId(game.aliases[i]);
					if (!(alias in this.aliases) && !(alias in this.games)) this.aliases[alias] = game.id;
				}
			}
			if (game.variations) {
				let variations = game.variations.slice();
				game.variations = {};
				for (let i = 0, len = variations.length; i < len; i++) {
					let variation = variations[i];
					let id = Tools.toId(variation.name);
					if (id in this.games) throw new Error(game.name + " variation '" + variation.name + "' is already a game.");
					variation.id = id;
					let variationId = Tools.toId(variation.variation);
					if (variationId in this.modes) throw new Error(variation.name + "'s variation '" + variation.variation + "' exists as a mode.");
					variation.variationId = variationId;
					game.variations[variationId] = variation;
					if (!(id in this.aliases)) this.aliases[id] = game.id + ',' + variationId;
					if (variation.aliases) {
						for (let i = 0, len = variation.aliases.length; i < len; i++) {
							let alias = Tools.toId(variation.aliases[i]);
							if (!(alias in this.aliases) && !(alias in this.modes)) this.aliases[alias] = game.id + ',' + variationId;
						}
					}
					if (variation.variationAliases) {
						if (!game.variationAliases) game.variationAliases = {};
						for (let i = 0, len = variation.variationAliases.length; i < len; i++) {
							let alias = Tools.toId(variation.variationAliases[i]);
							if (!(alias in game.variationAliases) && !(alias in this.modes)) game.variationAliases[alias] = variationId;
						}
					}
				}
			}
			if (game.modes) {
				let modes = game.modes.slice();
				game.modes = {};
				console.log('sup');
				for (let i = 0, len = modes.length; i < len; i++) {
					let modeId = Tools.toId(modes[i]);
					if (!(modeId in this.modes)) throw new Error(game.name + " mode '" + modeId + "' does not exist.");
					game.modes[modeId] = modeId;
					let prefix = this.modes[modeId].naming === 'prefix';
					let id;
					if (prefix) {
						id = this.modes[modeId].id + game.id;
					} else {
						id = game.id + this.modes[modeId].id;
					}
					if (!(id in this.aliases)) this.aliases[id] = game.id + ',' + modeId;
					console.log(this.aliases[id]);
					if (this.modes[modeId].aliases) {
						if (!game.modeAliases) game.modeAliases = {};
						for (let i = 0, len = this.modes[modeId].aliases.length; i < len; i++) {
							game.modeAliases[this.modes[modeId].aliases[i]] = modeId;
							let id;
							if (prefix) {
								id = this.modes[modeId].aliases[i] + game.id;
							} else {
								id = game.id + this.modes[modeId].aliases[i];
							}
							if (!(id in this.aliases)) this.aliases[id] = game.id + ',' + modeId;
						}
					}
				}
			}
		}
		this.importHost();
		this.importHosts();
	}

	getFormat(target) {
		if (typeof target === 'object') return target;
		target = target.split(',');
		let format = target.shift();
		let id = Tools.toId(format);
		console.log('id is ' + id);
		if (id in this.aliases) {
			id = this.aliases[id];
			console.log(id + ',' + target.join(','));
			if (id.includes(',')) return this.getFormat(id + ',' + target.join(','));
		}
		if (!(id in this.games)) return;
		format = Object.assign({}, this.games[id]);
		let variation, mode;
		for (let i = 0, len = target.length; i < len; i++) {
			let id = Tools.toId(target[i]);
			if (format.variations) {
				if (format.variationAliases && id in format.variationAliases) id = format.variationAliases[id];
				if (id in format.variations) variation = format.variations[id];
			}
			if (format.modes) {
				if (format.modeAliases && id in format.modeAliases) id = format.modeAliases[id];
				if (id in format.modes) mode = format.modes[id];
			}
		}
		if (variation) Object.assign(format, variation);
		if (mode) format.modeId = mode;
		return format;
	}

	createGame(target, room) {
		if (room.game) {
			room.say("A game of " + room.game.name + " is already in progress.");
			return false;
		}
		let format = this.getFormat(target);
		let baseClass;
		if (format.inherits) {
			let parentFormat = format;
			let parentFormats = [];
			while (parentFormat.inherits) {
				parentFormat = this.games[parentFormat.inherits];
				if (parentFormats.includes(parentFormat)) throw new Error("Infinite inherit loop created by " + format.name + ".");
				parentFormats.unshift(parentFormat);
			}
			baseClass = Game;
			for (let i = 0, len = parentFormats.length; i < len; i++) {
				baseClass = parentFormats[i].install(baseClass);
			}
			baseClass = format.install(baseClass);
		} else if (format.install) {
			baseClass = format.install(Game);
		} else {
			baseClass = format.game;
		}
		room.game = new baseClass(room); // eslint-disable-line new-cap
		Object.assign(room.game, format);
		if (format.modeId) this.modes[format.modeId].mode.call(room.game);
		return room.game;
	}

	createChildGame(format, parentGame) {
		parentGame.room.game = null;
		let childGame = this.createGame(format, parentGame.room);
		parentGame.childGame = childGame;
		childGame.parentGame = parentGame;
		childGame.players = parentGame.players;
		childGame.playerCount = parentGame.playerCount;
		return childGame;
	}
}

let Games = new GamesManager();
Games.Game = Game;
Games.Player = Player;
Games.backupInterval = setInterval(() => Games.exportHosts(), 60 * 1000);
Games.backupHostInterval = setInterval(() => Games.exportHost(), 60 * 1000);


module.exports = Games;
