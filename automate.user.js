// ==UserScript==
// @name         aardvark arcanum auto
// @version      0.5
// @author       aardvark
// @description  Automates casting buffs, buying gems making types gems, making lore. Adds sell junk/dupe item buttons. Must open the main tab and the spells tab once to work.
// @downloadURL  https://github.com/mettalogic/arcanum-automation/raw/master/automate.user.js
// @match        http://www.lerpinglemur.com/arcanum/
// @match        https://game312933.konggames.com/gamez/0031/2933/*
// @run-at       document-idle
// ==/UserScript==

var tc_debug = false;	// set to true to see debug messages

var tc_suspend = false;		// set this to true in console to suspend all auto functions

// Setting to false will stop individual actions
var tc_auto_misc = true;
var tc_auto_cast = true;
var tc_auto_focus = true;
var tc_auto_heal = true;

// Set to a adventure name to continously ruin that adventure, leave blank to disable
var tc_auto_adventure = "";

/* The following can be increased by encounters in the adventure listed.
(Stat) - ("dungeon name") (increased amount) (chance to get the encounter needed)

Skills:
Anatomy - "ruined crypt" 0.01 2/7
Spirit Lore - "hestia's cottage" 0.001 1/6, "explore treffil wood" 0.001 1/6
Charms - "hestia's cottage" 0.01 1/6
Enchanting - "hestia's cottage" 0.01 1/6
Potions - "hestia's cottage" 0.01 1/6
Scrying - "hestia's cottage" 0.001 1/6
History - "hestia's cottage" 0.001 1/6, "genezereth" 0.001 1/7
Crafting - "fazbit's workshop" 0.001 1/7
Pyromancy - "fazbit's workshop" 0.001 1/7
Alchemy - "fazbit's workshop" 0.001 2/7
Minerology - "genezereth" 0.001 1/7
Air Lore - "genezereth" 0.001 1/7

Stats:
Arcana - "pidwig's cove" 0.05 1/6
*/

var tc_auto_speed = 1000; // Speed in ms, going too low will cause performance issues.
var tc_auto_speed_spells = 950;	// interval in ms for spell casting. should be 1000, but lag can cause spells to run out

var tc_spells = new Map();
var tc_resources = new Map();
var tc_actions = new Map();
var tc_bars = new Map();
var tc_adventures = new Map();
var tc_focus;

var tc_time_offset = 0;

// List of Gems that needs to be updated manually if changed.
var tc_gems = {
	"arcane gem" : "imbue gem (arcane)",
	"fire gem" : "imbue gem (fire)",
	"water gem" : "imbue gem (water)",
	"nature gem" : "imbue lifegem",
	"earth gem" : "imbue stone",
	"air gem" : "imbue gem (air)",
	"shadow gem" : "imbue gem (shadow)",
	"light gem" : "imbue gem (light)",
	"spirit gem" : "imbue gem (spirit)",
	"blood gem" : "coagulate gem",
};

// List of spells to autocast when needed without using quickbar (and interval to cast at)
var tc_autospells = {
	"minor mana" : 30,
	"lesser mana" : 60,
	"mana" : 120,
	"minor fount" : 30,
	"fount" : 60,
	"wild growth" : 45,
	"abundance" : 60,
	"unseen servant" : 45,
	"guided strike" : 45,
	"true strike" : 45,
	"perfect strike" : 45,
	"whisper" : 50,
	"insight" : 60,
	"whirling step III" : 80,
	"dust devil II" : 45,
	"adamant shell" : 180,
	"pulsing light" : 45,
	"pulsing light II" : 60,
	"pulsing light III" : 120,
};

// Call this every second - will automatically pick up new spells
function tc_populate_spells()
{
	if (tc_gettab() !== "spells") return;

	for (let qs of document.querySelectorAll(".spells .bottom .spellbook table tr")) {
		if (qs.childElementCount == 3) {
			var spell = qs.children[1].innerHTML.toLowerCase();
			if (!tc_spells.get(spell) && !qs.children[2].firstChild.disabled) {
				tc_spells.set(spell, qs.children[2].firstChild);
				if (tc_debug) console.log("Saved spell: " + spell);
			}
		}
	}
}

// Call this every second to update resource values
function tc_populate_resources()
{
	for (let n of document.querySelectorAll("div.game-main div.resource-list tr.item-name:not(.locked)")) {
		var name = n.firstElementChild.innerHTML.toLowerCase();
		var vals = n.lastElementChild.innerHTML.split("/");
		var val0 = parseInt(vals[0]);
		var val1 = parseInt(vals[1]);
		tc_resources.set(name, [ val0, val1 ]);
	}
}

// Call every second to update mana bars
function tc_populate_bars()
{
	for (let n of document.querySelectorAll("div.game-main div.vitals table.bars tr")) {
		var name = n.firstElementChild.innerHTML.toLowerCase();
		var vals = n.querySelectorAll("span.bar-text")[0].innerText.split("/");
		var val0 = parseFloat(vals[0]);
		var val1 = parseFloat(vals[1]);
		tc_bars.set(name, [ val0, val1 ]);
	}
}

// Call every second to look for new buttons and ones that are now active.
function tc_populate_actions()
{
	if (tc_gettab() !== "main") return;

	for (let qs of document.querySelectorAll(".main-actions .action-list .action-btn:not(.locked) .wrapped-btn:not([disabled])")) {
		var key = qs.innerHTML.toLowerCase();
		if (!tc_actions.get(key)) {
			tc_actions.set(key, qs);
			if (tc_debug) console.log("Action stored: " + qs.innerHTML);
		}
	}
}

// Call every second to look for new adventures and adventures that are now active.
function tc_populate_adventures()
{
	if (tc_gettab() !== "adventure") return;

	//Map is set up as: name, [progress, needed, button]
	for (let qs of document.querySelectorAll("div.game-main div.locales div.dungeon")){
		if(!qs.children[0].children[0].children[1].disabled){
			var name = qs.children[0].children[0].children[0].innerText // name of dungeon
			var vals = qs.children[1].innerText.split("/")
			tc_adventures.set(name,[vals[0],vals[1],qs.children[0].children[0].children[1]]);
		}
	}
}

// Check if a resource is above a percentage. example: tc_check_resource("gold",.5);	// that's not a % lol
function tc_check_resource(resource,percent) {
	return !tc_resources.get(resource) || tc_resources.get(resource)[0] >= tc_resources.get(resource)[1] * percent;
}

// Check if a bar(mana etc) is above a percentage.
function tc_check_bars(bars,percent) {
	return !tc_bars.get(bars) || tc_bars.get(bars)[0] >= tc_bars.get(bars)[1] * percent;
}

// Return name of current tab
function tc_gettab()
{
	for (let tab of document.querySelectorAll("div.menu-items div.menu-item span")) {
		var s = tab.innerHTML;
		if (! /<u>/.test(s))
			return s.slice(1, -1);	// strip off leading and trailing space
	}
}

// Set current tab to "name"
function tc_settab(newtab)
{
	for (let tab of document.querySelectorAll("div.menu-items div.menu-item span")) {
		if (tab.innerHTML.indexOf(newtab) != -1) {
			tab.click();
			return;
		}
	}
}

// Clicks the selected adventure button
function tc_click_adv(adventure)
{
	var lcl = tc_adventures.get(adventure);
	if (!lcl) return;
	if (tc_suspend) return;

	if (lcl.disabled) {
		if (tc_debug) console.log("Adventure '" + adventure + "' was disabled - deleting it");
		tc_adventures.delete(adventure);
		return;
	}

	if (tc_debug) console.log("Clicking: " + adventure);
	lcl[2].click();
	return;
}

// Clicks the action button
function tc_click_action(action)
{
	var act = tc_actions.get(action);
	if (!act) return false;

	if (act.disabled) {	// not sure how this happens, but seems to prevent action ever being called again
		if (tc_debug) console.log("Action '" + action + "' was disabled - deleting it");
		tc_actions.delete(action);
		return false;
	}

	if (tc_debug) console.log("Clicking: " + action);
	act.click();
	return true;	// click might still have failed
}

// Clicks the spell button
function tc_cast_spell(spell)
{
	var spl = tc_spells.get(spell);
	if (!spl) return false;

	if (spl.disabled) {	// not sure how this happens, but seems to prevent action ever being called again
		if (tc_debug) console.log("Spell '" + spell + "' was disabled - deleting it");
		tc_spells.delete(spell);
		return false;
	}

	if (tc_debug) console.log("Casting: " + spell);
	spl.click();
	return true;
}

// Adds an input field to each button on the quickbar to allow casting at regular intervals. Author: iko
function iko_autocast()
{
	// Stuff for quickslot bar
	for (let qs of document.querySelectorAll(".quickslot")) {
		// If it doesn't have the text entry box yet then add it.
		if (!qs.lastElementChild.classList.contains("timeset")) {
			var box = document.createElement("input");
			box.setAttribute("type", "text");
			box.setAttribute("class", "timeset");
			box.setAttribute("style", "position:absolute;bottom:0px;left:0px;width:100%;font-weight:bold;opacity:0.75;text-align:center;");
			qs.appendChild(box);
		}

		var val = parseInt(qs.lastElementChild.value);
		if (val > 0 && tc_time_offset % val == 0 && qs.firstElementChild.firstElementChild !== null && qs.lastElementChild !== document.activeElement) {
			qs.firstElementChild.firstElementChild.click()
		}
	}
}

// For AUTOING. Casts spells listed under autospells
function tc_autocast()
{
	if (tc_suspend) return;
	if (!tc_auto_cast) return;

	for (var spell in tc_autospells) {
		var rpt = tc_autospells[spell];
		if (tc_time_offset % rpt == 0) {
			if (tc_debug) console.log("try casting " + spell);
			tc_cast_spell(spell);
		}
	}
}

// For AUTOING. Does several actions
function tc_automate()
{
	if (tc_suspend) return;
	if (!tc_auto_misc) return;

	tc_populate_resources();

	if (tc_check_resource("herbs",1) && !tc_check_resource("gold",1))
		for (let i=0; i < 10; ++i)
			tc_click_action("sell herbs");

	if (tc_check_resource("research",1) && !tc_check_resource("scrolls",1) && tc_check_bars("mana",.75))
		tc_click_action("scribe scroll");
	if (!tc_check_resource("codices",1) && tc_check_resource("scrolls",1) && tc_check_bars("mana",.5))
		tc_click_action("bind codex");
	// Selling scrolls can be useful late game when we're automatically generating them,
	// and buying scrolls is useful at the start,
	// but there was a problem here when scrolls = max-1 and we bought a scroll, then scrolls were maxed but money wasn't
	// so next tick we'd sell the scroll and so we'd never be able to max either.
	if (tc_resources.get("gold")[0] < tc_resources.get("gold")[1] - 20 && tc_check_resource("scrolls",1))
		tc_click_action("sell scroll");
	else if (tc_check_resource("gold",1) && !tc_check_resource("scrolls",1))
		tc_click_action("buy scroll");	// could fail if scribe above maxed them

	// If money maxed, buy gem
	if (tc_check_resource("gold",1) && !tc_check_resource("gems",1))
		tc_click_action("purchase gem");

	// If gems maxed, try making some different ones
	if (tc_check_resource("gems",1)) {
		for (var gem in tc_gems) {	// try to make one of each
			if (!tc_check_resource(gem,1)) {
				if (tc_debug) console.log("not maxed " + gem + " calling " + tc_gems[gem]);
				tc_click_action(tc_gems[gem]);
			}
		}
		// could also buy the gem box here
	}

	// Sublimate lore
	if (tc_check_resource("codices",1)) {
		if (tc_click_action("sublimate lore"))
			for (let qs of document.querySelectorAll(".popup"))
				if (qs.firstElementChild.innerHTML == "sublimate lore")
					qs.children[3].firstElementChild.click();
	}
}

// For AUTOING. Runs an adventure again after you have finished it.
function tc_autoadv()
{
	if (tc_suspend) return;
	var lcl = tc_adventures.get(tc_auto_adventure);
	if (!lcl) return;

	var advper = lcl[0]/lcl[1];
	if (advper == 0 || advper == 1) tc_click_adv(tc_auto_adventure); // this might just need to be advper==1

}

// Sells all items that are considered junk
function tc_selljunk()
{
	var sell_exact = [ "amulet", "band", "belt", "boots", "broomstick", "cane", "cap", "cape", "cincture", "cloak", "club", "collar", "conical helm", "dagger", "girdle", "gloves", "greaves", "hat", "jerkin", "knife", "loop", "necklace", "pendant", "ring", "robe", "sash", "shortsword", "spear", "staff" ];
	var sell_match = [ "silk ", "cotton ", "stone ", "leather ", "^wood ", "bone ", "bronze ", "iron ", "^steel " ];	// aggressive

	// "silk ", "cotton ", "stone ", "leather ", "^wood ", "bone ", "bronze ", "iron ", "^steel ", "quicksteel ", "mithril ", "ebonwood ", "ethereal ", "adamant "

	function checkmatch(m) { for (let i of sell_match) if (RegExp(i).test(m)) return true; return false; }

	for (let row of document.querySelectorAll(".adventure .raid-bottom .inv table tr")) {
		// table has 4 columns: name + 3 buttons: Equip, Take, Sell
		if (row.children[3].children[0].innerText == "Sell") {
			var item = row.children[0].innerText;
			if (sell_exact.indexOf(item) != -1 || checkmatch(item)) {
				if (tc_debug) console.log("Selling: " + item);
				row.children[3].children[0].click();
			}
		}
	}
}

// Sells any item that you have more than one of
function tc_selldups()
{
	var items = new Map(); // test

	// Build a map of item -> qty
	for (let row of document.querySelectorAll(".adventure .raid-bottom .inv table tr")) {
		// table has 4 columns: name + 3 buttons: Equip, Take, Sell
		if (row.children[3].children[0].innerText == "Sell") {
			var item = row.children[0].innerText;
			var qty = items.get(item);
			items.set(item, qty ? qty+1 : 1);
		}
	}

	// Now iterate over rows, selling items where qty > 1
	for (let row of document.querySelectorAll(".adventure .raid-bottom .inv table tr")) {
		// table has 4 columns: name + 3 buttons: Equip, Take, Sell
		if (row.children[3].children[0].innerText == "Sell") {
			var item = row.children[0].innerText;
			var qty = items.get(item);
			var maxqty = 1;
			var itemtype = "";
			switch(item.split(" ").pop()){
				case "pendant": case "collar": case "amulet": case "necklace":
					maxqty = 3;
					break;
				case "band": case "loop": case "ring":
					maxqty = 4;
					break;
				case "shortsword": case "club": case "cane": case "knife": case "broomstick": case "dagger": case "axe": case "mace":
					maxqty = 2;
					break;
				default:
					maxqty = 1
					break;
			}
		}
		if (qty > maxqty) {
			if (tc_debug) console.log("Selling: " + item);
			row.children[3].children[0].click();
			items.set(item, qty-1);
		}
	}
}

// Adds a filter input for loot gained from adventures.
function tc_lootfilter()
{
	var input = document.getElementById("lootfilter");
	if (!input) return;
	var filter = input.value;
	if (tc_debug) console.log("filter: " + filter);

	if (filter.length == 0) {
		// Clear all hidden
		for (let row of document.querySelectorAll(".adventure .raid-bottom .inv table tr"))
			row.style.display = "";
	}
	else {
		for (let row of document.querySelectorAll(".adventure .raid-bottom .inv table tr"))
			if (row.children[0].innerText.indexOf(filter) != -1)
				row.style.display = "";
			else
				row.style.display = "none";
	}
}

// Create junk and dupe sell buttons and a loot filter if not already present
function tc_sellsetup()
{
	if (tc_gettab() != "adventure") return;
	if (document.getElementById("selldups")) return;

	var sellall = document.querySelectorAll(".adventure .raid-bottom .inv div.flex-row button");
	if (sellall.length == 0) return;	// nothing to sell on tab yet
	sellall = sellall[0];

	var selljunk = document.createElement("button");
	var t1 = document.createTextNode("Sell Junk");
	selljunk.appendChild(t1);
	selljunk.addEventListener("click", tc_selljunk);

	var selldups = document.createElement("button");
	var t2 = document.createTextNode("Sell Dupes");
	selldups.appendChild(t2);
	selldups.addEventListener("click", tc_selldups);
	selldups.id = "selldups";

	var br = document.createElement("br");
	var t3 = document.createTextNode("Filter");
	var filter = document.createElement("Input");
	filter.addEventListener("keyup", tc_lootfilter);
	filter.id = "lootfilter";
	filter.width = "50";

	sellall.parentNode.insertBefore(selljunk, null);
	sellall.parentNode.insertBefore(selldups, null);
	sellall.parentNode.insertBefore(br, null);
	sellall.parentNode.insertBefore(t3, null);
	sellall.parentNode.insertBefore(filter, null);
	if (tc_debug) console.log("Sell buttons added");
}

// Puts a button to set which dungeon to auto and pressing flee will cancle. Code based off of code by Bz
function tc_advsetup()
{
	if (tc_gettab() !== "adventure") return;
	if (tc_suspend) return;
	// makes clicking flee disable the auto adventure
	if (document.querySelector("div.game-main div.adventure div.explore .raid-btn"))
	{
		document.querySelector("div.game-main div.adventure div.explore .raid-btn").addEventListener("click", function(){tc_auto_adventure = "";})
	}

	// Creates an auto button for every adventure.
	for (let qs of document.querySelectorAll("div.game-mid div.adventure div.locales div.dungeon span.separate:first-child")){
		if (qs.lastElementChild.innerText !== "Auto"){
			var seldungeon = document.createElement("button");
			seldungeon.appendChild(document.createTextNode("Auto"));
			seldungeon.addEventListener("click", function(){
				tc_auto_adventure = qs.firstElementChild.firstElementChild.innerText;
				tc_click_adv(tc_auto_adventure)});
			qs.appendChild(seldungeon);
		}
	}
}

// Uses focus until you have only 10 mana left.
function tc_autofocus()
{
	if (tc_suspend) return;
	if (!tc_auto_focus) return;

	if (!tc_focus)
	for (let qs of document.querySelectorAll(".vitals div.separate button.btn-sm")) {
		if (!tc_focus && qs.innerHTML === "Focus")
			tc_focus = qs;
	}
	if (!tc_bars.get("mana")) return;
	var amt = tc_bars.get("mana")[0];
	var max = tc_bars.get("mana")[1];

	// 10 mana required for compile tome
	var min = max < 11 ? max-1 : 10;
	if (amt >= min) {
		for (let i = 10 * (amt-min); i > 0; i--)
			tc_focus.click();
	}
}

// Autoheal based on avalibility of spells and need.
function tc_autoheal()
{
	if (tc_suspend) return;
	if (!tc_auto_heal) return;

	if (tc_spells.has("sealing light iii")) {
		if (tc_bars.get("hp")[1]-tc_bars.get("hp")[0] >= 100 && tc_bars.get("light")[1] >= 7)
			tc_cast_spell("sealing light iii")
		return;
	}

	if (tc_spells.has("sealing light ii")){
		if (tc_bars.get("hp")[1]-tc_bars.get("hp")[0] >= 50 && tc_bars.get("light")[1] >= 5)
			tc_cast_spell("sealing light ii");
	} else if (tc_spells.has("sealing light")){
		if (tc_bars.get("hp")[1]-tc_bars.get("hp")[0] >= 15 && tc_bars.get("light")[1] >= 5)
			tc_cast_spell("sealing light");
	}
}

// Functions to load and save settings from local storage and display configuration dialog.

function tc_load_settings()
{
	// All data stored in localStorage is of type string - need to convert it back.
	// Also allow default values for first time running script.
	function get_val(name, default_val, type) {
		var val = localStorage.getItem(name);
		if (val === null) return default_val;
		if (type === "bool") return val === "true";
		if (type === "int") return parseInt(val);
		return val;
	}

	// Set default values here to be "noob-friendly"
	tc_suspend = get_val("tc_suspend", false, "bool");
	tc_auto_cast = get_val("tc_auto_cast", true, "bool");
	tc_auto_focus = get_val("tc_auto_focus", true, "bool");
	tc_auto_heal = get_val("tc_auto_heal", true, "bool");
	tc_auto_misc = get_val("tc_auto_misc", true, "bool");
	tc_auto_speed = get_val("tc_auto_speed", 1000, "int");
	tc_auto_speed_spells = get_val("tc_auto_speed_spells", 950, "int");
	tc_debug = get_val("tc_debug", false, "bool");

	document.getElementById("tc_suspend").checked = !tc_suspend;	// this one's backwards
	document.getElementById("tc_auto_cast").checked = tc_auto_cast;
	document.getElementById("tc_auto_focus").checked = tc_auto_focus;
	document.getElementById("tc_auto_heal").checked = tc_auto_heal;
	document.getElementById("tc_auto_misc").checked = tc_auto_misc;
	document.getElementById("tc_auto_speed").value = tc_auto_speed;
	document.getElementById("tc_auto_speed_spells").value = tc_auto_speed_spells;
	document.getElementById("tc_debug").checked = tc_debug;
}

function tc_save_settings()
{
	tc_suspend = !document.getElementById("tc_suspend").checked;	// this one's backwards
	tc_auto_cast = document.getElementById("tc_auto_cast").checked;
	tc_auto_focus = document.getElementById("tc_auto_focus").checked;
	tc_auto_heal = document.getElementById("tc_auto_heal").checked;
	tc_auto_misc = document.getElementById("tc_auto_misc").checked;
	tc_auto_speed = parseInt(document.getElementById("tc_auto_speed").value);
	tc_auto_speed_spells = parseInt(document.getElementById("tc_auto_speed_spells").value);
	tc_debug = document.getElementById("tc_debug");

	localStorage.setItem("tc_suspend", tc_suspend);
	localStorage.setItem("tc_auto_cast", tc_auto_cast);
	localStorage.setItem("tc_auto_focus", tc_auto_focus);
	localStorage.setItem("tc_auto_heal", tc_auto_heal);
	localStorage.setItem("tc_auto_misc", tc_auto_misc);
	localStorage.setItem("tc_auto_speed", tc_auto_speed);
	localStorage.setItem("tc_auto_speed_spells", tc_auto_speed_spells);
	localStorage.setItem("tc_debug", tc_debug);

	// Now need to restart timers with new values
	start_timers();
}

function tc_close_config_cancel()
{
	var config = document.getElementById("config_options");
	if (!config) return;

	config.style.display = "none";
	if (tc_debug) console.log("config close (cancel) clicked");
}

function tc_close_config_save()
{
	var config = document.getElementById("config_options");
	if (!config) return;

	tc_save_settings();
	config.style.display = "none";
	if (tc_debug) console.log("config close (save) clicked");
}

function tc_show_config()
{
	var config = document.getElementById("config_options");
	if (!config) return;
	
	// Set the background color as the user might have changed modes.
	// Make it slightly lighter/darker than normal background so it's more obvious.
	config.style.backgroundColor = document.firstElementChild.children[1].className == "darkmode" ? "#333" : "#eee";
	 
	tc_load_settings();
	config.style.display = "block";
	if (tc_debug) console.log("config clicked");
}

function tc_config_setup()
{
	if (document.getElementById("automate_config")) return;

	// Try to add the config button to the quickslot bar, but if the user hasn't created any shortcuts yet fall back to quickbar
	var config = document.querySelectorAll(".quickslot");
	if (config.length == 0) {
		config = document.querySelectorAll(".quickbar");
		if (config.length == 0) return;	// nothing to add it to
	}
	config = config[0];

	var configbtn = document.createElement("button");
	var t1 = document.createTextNode("Configure Automation");
	configbtn.appendChild(t1);
	configbtn.id = "automate_config";
	configbtn.style = "margin-left: auto";	// align right in flexbox
	configbtn.addEventListener("click", tc_show_config);

	var dummy = document.createElement('div');	// this div won't be included, only the HTML below
	// Need to specify a background color or the dialog will be transparent.
	// Will get fixed to match dark/light mode when it's opened in tc_show_config()
	// Looks ugly, but will do for now.
	// Add auto adventuring?
	// Add equipment considered junk
	var html = `
<div id="config_options" class="settings popup" style="display:none; background-color:#777; max-width:800px; position: absolute; bottom:15px; right: 15px; top: auto; left: auto;">
<input type="checkbox" name="tc_suspend" id="tc_suspend" title="If unchecked, all automation is suspended. If checked, items enabled below will be run."> enable automation of items below<br><br>
<input type="checkbox" name="tc_auto_misc" id="tc_auto_misc"> buy gems, sell herbs, scribe scrolls etc.<br>
<input type="checkbox" name="tc_auto_focus" id="tc_auto_focus"> click focus while learning skills<br>
<input type="checkbox" name="tc_auto_cast" id="tc_auto_cast" title="e.g. mana, fount"> cast common buff spells<br>
<input type="checkbox" name="tc_auto_heal" id="tc_auto_heal"> cast healing spells in combat<br>
<hr>
<input type="text" name="tc_auto_speed" id="tc_auto_speed" width=10> interval (ms) to run automation functions<br>
<input type="text" name="tc_auto_speed_spells" id="tc_auto_speed_spells" width=10 title="Should be 1000 but reduce it if lag is causing spell buffs to expire"> interval (ms) for spellcast functions<br>
<hr>
<input type="checkbox" name="tc_debug" id="tc_debug"> send debug info to console<br>
<hr>
<button type="button" onclick="tc_close_config_cancel()">Cancel</button>
<button type="button" onclick="tc_close_config_save()">Save</button>
</div> `;
	dummy.innerHTML = html;
	document.body.firstElementChild.appendChild(dummy);

	config.parentNode.insertBefore(configbtn, null);
	if (tc_debug) console.log("Config button added");
}


/*
	Basic Automation Stuff
*/

// Do this before we start any timers - loads timer values etc. from local storage.
tc_config_setup();
tc_load_settings();

// Main timer for most functions
var tc_timer_ac;
// Timer for spells.
// Can't guarantee that timer will work exactly every second, so can reduce interval to compensate so spells don't run out
var tc_timer_autocast;

function start_timers()	// can be restarted by save_settings()
{
	if (tc_timer_ac != undefined)
		window.clearInterval(tc_timer_ac);
	if (tc_timer_autocast != undefined)
		window.clearInterval(tc_timer_autocast);

	tc_timer_ac = window.setInterval(function() {
		tc_populate_spells();
		tc_populate_resources();
		tc_populate_actions();
		tc_populate_bars();
		tc_populate_adventures();
		tc_automate();
		tc_autofocus();
		tc_autoheal();
		tc_autoadv();
		tc_sellsetup();
		tc_advsetup();
	}, tc_auto_speed);

	tc_timer_autocast = window.setInterval(function() {
		iko_autocast();
		tc_autocast();
		tc_time_offset++;	// must be done here so it works even if tc_autocast disabled
	}, tc_auto_speed_spells);
}

start_timers();
