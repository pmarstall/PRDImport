/* PATHFINDER STAT BLOCK IMPORTER FOR ROLL20 API
    Author Jason.P 18/1/2015
    Version 2.25
    
    Updated to Parse both Ranged and Melee attacks (Aaron you will see a lot of your influence here! :-D)
    
    This script was written to import as much detail as possible from Pathfinder Reference Document's
    Stat Blocks into the Pathfinder NPC sheets. (may work a HeroLab stat blocks too, need to test)
	
    ****** Huge shout out first of all to Aaron for all his help and feedback. Wouldn't be able to do this without the tips!
	****** Also Peter W for his original layout and the initial parsing. Kevin and HoneyBadger too for their work of this kind.
	
	IT IMPORTS:
	Name
	CR 
	XP
    	Race
	class name and level
	Alignment
	Type and Subtype (string)
	Size
	Initiative Bonus (so total Init adds up with dex mod correctly)
	Senses (string)
	Auras (string)
	AC bonuses broken down:  Armour, Shield, Deflect, Dodge, Natural (sheet does Size, Dex)-  all others report to Misc
	HP
	Fort, Ref, Will saves (bonuses that add up correctly with releant ability mods) + save notes
	Defensive Abiliites (string, only if the line leads with "Defensive Abilities")
    	Weaknesses,DR,Resistances,Immunities,SR 
	Speed (base, burrow, climb, fly, maneuverability, swim)
	Special Attacks (string)
	Tactics (Before combat, during combat as string)
	Abilities (STR - > CHA)
	Base Attack Bonus
    	Feats
	Languages (as string)
	Special Qualities (as string)
	Gear (combat, Other as string)
    	Melee and Ranged Attacks (Parses, writes attack roll and damage roll macros, partially updates Repeating Weapon slots in char 	sheet)
    
    
	IT DOES NOT AT THIS POINT IMPORT:
	special abilities
    	spells
    	CMB,CMD specifics and Notes 
	
	Slowly working through the list of 'does nots'. next on the chopping block- Special abilities!
	INSTRUCTIONS
	1. Go to PRD (PFSRD does work, but beware formatting!) website, find yourself some baddies (or NPC's)
	2. Copy the stat block from *Name CRX* to Combat/Other Gear (or SQ, whatever is last. Can copy more, just doesn't get used)
	3. Paste the stat block into the GM Notes Section of a token in your roll20 campaign.
        Clean up the title as you want it to appear in your Journal - like "Valeros CR12"
	4. in the chat box, type the command "!PathfinderImport".
	
	Happy gaming! Hope this makes things easier for you to throw hoards of baddies at your players!
	
	Let me know if you have any feedback, be it tips, improvement ideas, or requests
	(keep in mind i was introduced to Javascript 2 days ago!)
	
*/


var RegExpEscapeSpecial =/([\/\\\/\[\]\(\)\{\}\?\+\*\|\.\^\$])/g;


var AddAttribute = AddAttribute || {};
function AddAttribute(attr, value, charID) {
    if (value === undefined )
    {
        log(attr + " has returned an undefined value.");
        sendChat("Error on " + attr + " attribute", "This attribute has been ignored.");
    }
    else
    {
    createObj("attribute", {
		name: attr,
		current: value,
		characterid: charID
        
	});
    //use the line below for diagnostics!
    //log(attr + ", " + value);
	return;
    }
}
// function that adds the various abilities
var AddAbility = AddAbility || {};
function addAbility(ability, text, charID) {
createObj("ability", {
                name: ability,
                description: "",
                action: text,
                istokenaction: true,
                characterid: charID
            });
}   
            
function stripString(str, removeStr, replaceWith) {
    var r= new RegExp(removeStr.replace(RegExpEscapeSpecial,"\\$1"),'g');
    return str.replace(r,replaceWith);
}




/*Cleans up the string leaving text and hyperlinks */
function cleanUpString(strSpecials)  {
    strSpecials = stripString(strSpecials, "%20", " ");
    strSpecials = stripString(strSpecials, "%22", "\"");
    strSpecials = stripString(strSpecials, "%29", ")");
    strSpecials = stripString(strSpecials, "%28", "(");
    strSpecials = stripString(strSpecials, "%2C", ",");
 
 
    var inParens = 0;
    for (var i = 0; i < strSpecials.length; i++)
    {
        if (strSpecials[i]==="(")
            inParens++;
        if (strSpecials[i]===")")
            inParens--;
            
        if ((inParens > 0) && (strSpecials[i]===","))
        {
            var post = strSpecials.slice(i);   
            strSpecials = strSpecials.replace(post,"") ;
            post = post.replace(","," ");
 
            strSpecials = strSpecials + post;
        }
            
    }
    
 
    strSpecials = stripString(strSpecials, "%3C", "<");
    strSpecials = stripString(strSpecials, "%3E", ">");
    strSpecials = stripString(strSpecials, "%23", "#");
    strSpecials = stripString(strSpecials, "%3A", ":");
    strSpecials = stripString(strSpecials, "%3B", ",");
    strSpecials = stripString(strSpecials, "%3D", "=");
    
    strSpecials = stripString(strSpecials, "</strong>", "");
    strSpecials = stripString(strSpecials, "<strong>", "");
    strSpecials = stripString(strSpecials, "</em>", "");
    strSpecials = stripString(strSpecials, "<em>", "");
    strSpecials = stripString(strSpecials, "%u2013", "-");
    strSpecials = stripStringRegEx(strSpecials, "<b", ">");
    strSpecials = stripString(strSpecials, "</b>", "");
    strSpecials = stripStringRegEx(strSpecials, "<h", ">");
    strSpecials = stripStringRegEx(strSpecials, "</h", ">");
    
    strSpecials = stripString(strSpecials, "</a>", "");    
    
    strSpecials = stripStringRegEx(strSpecials, "<t", ">");
    strSpecials = stripStringRegEx(strSpecials, "</t", ">");
    
    while (strSpecials.search(/%../) != -1) {
        strSpecials = strSpecials.replace(/%../, "");
    }  
    
    return strSpecials;
}


/* Deletes any characters between the character a and b in incstr */
function stripStringRegEx(incstr, a, b) {
    var ea = a.replace(RegExpEscapeSpecial,"\\$1"),
        eb = b.replace(RegExpEscapeSpecial,"\\$1"),
        r = new RegExp( ea+'.*?'+eb , 'g');
    return incstr.replace(r,'');
}


/* Deletes the links from the string str */
function removeLinks(str) {
    return stripStringRegEx(str, "<", ">");
}


//looks for an occurrence of str in the array strArray, if found returns that element
// on doConcat, strips a trailing "and" and concatenates with the next line.
function findString(strArray, str, doConcat) {
    var retr,
    r = new RegExp(str.replace(RegExpEscapeSpecial,"\\$1"));
    _.find(strArray,function(v,k,l){
        if(v.match(r)){
            retr = v;
            if(doConcat && v.match(/and$/) && l[k+1]) {
                retr=retr.replace(/and$/,'')+', '+l[k+1];
            }
            return true;
        }
        return false;
    });
    return retr;
};


/* returns the string between two characters a/b */
function getSubStr(str, a, b) {
    var ea = a.replace(RegExpEscapeSpecial,"\\$1"),
        eb = b.replace(RegExpEscapeSpecial,"\\$1"),
        r = new RegExp( ea+'(.*?)'+eb),
        m = str.match(r); 
    return m && m[1];
}


/* returns every string between two characters a/b */
function getAllSubStr(str, a, b) {
    var ea = a.replace(RegExpEscapeSpecial,"\\$1"),
        eb = b.replace(RegExpEscapeSpecial,"\\$1"),
        r = new RegExp( ea+'(.*?)'+eb,'g'),
        m = str.match(r); 
    return m;
}


//removes numbers from array and trims white space on ends of elements
function removeNumbersFromArray (strArray)
{
    return _.map(strArray,function(s){
        return s.replace(/\d+/g,'').trim();
    });
}


function removeNonNumericFromArray (strArray)
{
    return _.map(strArray,function(s){
        return parseInt(s.replace(/\D+/g,''),10 || 0);
    });
}


function sumArray(numArray) {
    return _.reduce(numArray,function(acc,n){
        return acc + ( parseInt(n,10) || 0 );
    }, 0);
}




function getAbilityMod(ability) {
    return Math.floor((ability-10)/2);
}


function parseAttack(data,searchString, attackBonus, dmgBonus, reach,repeatStartNum, charID) {
        // start with the whole attack line    
    var attackLine = findString(data, searchString, true);
    if (attackLine === false || attackLine === undefined) {
        return 0
    } else {
    
        attackLine = attackLine.replace(searchString,"");
        attackLine = attackLine.trim();
        //separate the attack line into two arrays, one with content from outside brackets, one inside.
        var attackBrackets = getAllSubStr(attackLine,"(", ")");
        var attackNoBrackets = stripStringRegEx(attackLine,"(", ")");
        attackNoBrackets = stripString(attackNoBrackets," and ",",");
        attackNoBrackets = stripString(attackNoBrackets," or ",",");
        attackNoBrackets = attackNoBrackets.split(",");
        //initialise the variables outside the loops
        var attackName = "",
            dmgDiceNum = "",
            dmgDiceSides = "",
            dmgDiceAdd = "",
            threatenString = "",
            critMultString = "",
            attackString = ""
            attackValues = [""]
            attack = 0
            damage = 0
            enhance = [0]
            mwk = [0]
            abilityAttackString = ""
            abiStrAttackHeader = ""
            abiStrAttack = ""
            abiStrAttackFooter = ""
            extraDice = "";
        // cycle through each element in the array of attacks
        for ( i=0; i<attackNoBrackets.length; i++) {
            attackNoBrackets[i] = attackNoBrackets[i].trim();
            
            //if there are any spaces inside brackets (indicating there is an extra effect)
            // then set the extraDice = everything after the first space, else ""
            if(attackBrackets[i].match(/\S+\s/) === null) {
                extraDice = ""
            } else {
                extraDice = attackBrackets[i].replace(/\S+\s/, "");
            }
            
            extraDice = extraDice.replace(")","");
            //adds the hits and crits mod tag for use in the damage macro later, as well as surrounding
            //anything in format  XdX with [[ ]] brackets for an inline roll.
            extraDice = extraDice.replace(/(\d+d\d)/g,"[[(?{Hits-Landed|0}+?{Crits-Landed|0})*$1]]");
            //search for anything followed by a + in the attack, store as name. ( ) save name separate to +
            attackName = attackNoBrackets[i].match(/(.*) \+/);
            //search for XdX(+/-)X and store as damage string.
            dmgString = attackBrackets[i].match(/(\d+)d(\d+)\+*?(\-*?\d+)/);
            
            //This if handles the case where the damage is just XdX  (no addition or subtraction)
            if (dmgString === null) {
                dmgString = attackBrackets[i].match(/(\d+)d(\d+)/);
                dmgDiceAdd = 0;
            } else {
                dmgDiceAdd = parseInt(dmgString[3],10);
            }
            
            dmgDiceNum = parseInt(dmgString[1],10);
            dmgDiceSides = parseInt(dmgString[2],10);
            
            
            //search for X- as threaten (eg 19-20 = 19), "/x"X as crit multiplier
            threatenString = attackBrackets[i].match(/\/(\d+)-/);
            critMultString = attackBrackets[i].match(/\/(\d+)\)/);
            //if the first character is a + (eg +4 longsword) then remove the +, store the enhancement
            enhance[i] = 0
            if (attackNoBrackets[i].charAt(0)=== "+") {
                enhance[i] = parseInt(attackNoBrackets[i].charAt(1),10);
                attackNoBrackets[i] = attackNoBrackets[i].slice(1);
            }
            
            if (enhance[i] > 0) {
                mwk[i] = 1
            } else {
                mwk[i] = 0
            }
            
            attackString = attackNoBrackets[i].match(/\+(\d+)/g);
            attackValues = [""]
            
            for (n=0; n<attackString.length; n++) {
             attackValues[n] = parseInt(attackString[n].replace("+",""),10);
            }
            
            if (threatenString === null) {
                threatenString = [20,20]
            }
            
            if (critMultString === null) {
                critMultString = ["/x2",2]
            }
            
            //define the parts of the attack formula (header, body, footer)
            abiStrAttackHeader = "/e @{Selected|Token_Name} attacks with "+attackName[1]+"!!!";
            abiStrAttack = "";
            for (j = 0; j< attackString.length;j++) {
                abiStrAttack = abiStrAttack + "\nAttack "+(j+1)+": [[1d20 "+attackString[j]+"]]"
                }
            abiStrAttackFooter = "\nCrit on "+threatenString[1]+critMultString[0]+", "+reach+"ft Range)";
            
            //add the ability with the concatenated formula string
            abilityAttackString = abiStrAttackHeader + abiStrAttack + abiStrAttackFooter;
            addAbility(attackName[1], abilityAttackString, charID)
            
            //define the parts of the damage formula (Header, Body, Footer)
            abiStrDamageHeader = "/e @{Selected|Token_name}'s "+ attackName[1] + " damage";
            abiStrDamage = "\nTotal: [[(?{Hits-Landed|0}*"+dmgDiceNum+")d"+dmgDiceSides+"+?{Hits-Landed|0}*"+dmgDiceAdd+"+(?{Crits-Landed|0}*"+dmgDiceNum*critMultString[1]+")d"+dmgDiceSides+"+?{Crits-Landed|0}*"+dmgDiceAdd*critMultString[1]+")]] in ?{Hits-Landed|0} Hits and ?{Crits-Landed|0} Criticals.";
            abiStrDamageFooter = "\n"+extraDice
           
            abilityDamageString = abiStrDamageHeader + abiStrDamage + abiStrDamageFooter;
            addAbility(attackName[1]+"-DMG", abilityDamageString, charID);
            var attackType = 0
            var damageAbility = 0
            if (searchString === "Melee") {
                attackType = "@{attk-melee}"
                damageAbility = "@{STR-mod}"
            } else if (searchString === "Ranged") {
                attackType = "@{attk-ranged}"
            }


            attack = attackValues[0]-attackBonus - enhance[i]
            //assumes all melee attacks use full str bonus...
            damage = dmgDiceAdd -dmgBonus - enhance[i]


            // add repeating weapon X attributes (enhance = 1 and masterwork by default at this point
            var repeatNum = i+repeatStartNum;
            AddAttribute("repeating_weapon_"+repeatNum+"_enhance",enhance[i],charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_masterwork",mwk[i],charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_name",attackName[1],charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_attack",attack,charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_attack-type",attackType,charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_damage-dice-num",dmgDiceNum,charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_damage-die",dmgDiceSides,charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_damage",damage,charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_damage-ability",damageAbility,charID);
            
            AddAttribute("repeating_weapon_"+repeatNum+"_crit-target",threatenString[1],charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_crit-multiplier",critMultString[1],charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_range",reach,charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_proficiency","Yes",charID);
            AddAttribute("repeating_weapon_"+repeatNum+"_notes","TestNotes",charID);
            
        }  
        
        return attackNoBrackets.length
    }
}


on('chat:message', function (msg) {
 
    // Only run when message is an api type and contains "!PathfinderImport"
    if (msg.type == 'api' && msg.content.indexOf('!PathfinderImport') !== -1) {
 
    if (!(msg.selected && msg.selected.length > 0)) return; // Make sure there's a selected object
 
    var token = getObj('graphic', msg.selected[0]._id);
    if (token.get('subtype') != 'token') return; // Don't try to set the light radius of a drawing or card
    
    
    //*************  START CREATING CHARACTER****************
    // get notes from token
    var originalGmNotes = token.get('gmnotes');
    var gmNotes = token.get('gmnotes');
    
    //strip string with function
    gmNotes = stripString(gmNotes, "%3C/table%3E", "%3Cbr");
    gmNotes = stripString(gmNotes, "%3C/h1%3E", "%3Cbr");
    gmNotes = stripString(gmNotes, "%3C/h2%3E", "%3Cbr");
    gmNotes = stripString(gmNotes, "%3C/h3%3E", "%3Cbr");
    gmNotes = stripString(gmNotes, "%3C/h4%3E", "%3Cbr");
    
    //break the string down by line returns
    var data = gmNotes.split("%3Cbr");
    
    //clean any characters excepting text and hyperlinks
    for (var i = 0; i < data.length; i++) 
    {
        data[i] = cleanUpString(data[i]);
        data[i] = removeLinks(data[i]);
        if (data[i][0]===">")
        {
            data[i] = data[i].replace(">","");
        }
    }
    
    for (var i = 0; i < data.length; i++) {
        if (data[i] !== null){
        data[i] = data[i].trim();
        }
    }


    var charName = data[0].trim();
    
    // check if the character entry already exists, if so error and exit.
    var CheckSheet = findObjs({
        _type: "character",
        name: charName
    });
    
    if (CheckSheet.length > 0) {
        sendChat("ERROR", "This character already exists.");
        return;
    };
    
    //Create character entry in journal, assign token
    var character = createObj("character", {
        avatar: token.get("imgsrc"),
        name: charName,
        bio: token.get('gmnotes'),
        gmnotes: token.get('gmnotes'),
        archived: false
    });
    
    var charID = character.get('_id');
    token.set("represents", charID);
    
    //Determine and enter CR
    var Header = data[0].split("CR");
    var tokenName = Header[0].trim();
    var CR = Header[1];
    AddAttribute("npc-cr",CR,charID);
    
    //split and enter XP
    var xpHeader = data[1].split(" ");
    var XP = xpHeader[1];
    AddAttribute("npc-xp",XP,charID);
    
    //race, class, level
    var raceMatch = data[2].match(/(\w+)\s(\w+)\s(\d+)/)
    if( raceMatch!= null) {
        var race = raceMatch[1], 
            className = raceMatch[2],
            classLevel = raceMatch[3];
    AddAttribute("race",race,charID)
    AddAttribute("class-0-name",className +" "+ classLevel,charID)
    }
    
    // Alignment, Size, Type
    var sizesWithSpace = "Fine ,Diminutive ,Tiny ,Small ,Medium ,Large ,Huge ,Gargantuan ,Colossal ";
    var sizesArray = sizesWithSpace.split(",");


    for (var i = 0; i < 9; i++) 
    {
        if (findString(data, sizesArray[i], true) !== undefined) 
        {
            var sizeLine = findString(data, sizesArray[i], true);
            break;
        }
        
    }
    
    //get subtype before destroying string


    
    
    var subType = getSubStr(sizeLine, "(", ")");
    
    //remove the brackets and anything between them, trim the string,
    //create the array split at spaces, then assign the alignment to the sheet.
    var typeArray = stripStringRegEx(sizeLine, "(", ")");
    typeArray = typeArray.trim();
    typeArray = typeArray.split(" ");
    AddAttribute("alignment",typeArray[0],charID);
    
    // apparently i have to convert size into a value?
    var sizes = ["Fine","Diminutive","Tiny","Small","Medium","Large","Huge","Gargantuan","Colossal"];
    var sizeTable = [8,4,2,1,0,-1,-2,-4,-8];
    var sizeNum = sizeTable[sizes.indexOf(typeArray[1])];
    AddAttribute("size",sizeNum,charID);
    
    // concatenate type and subtype to put into the text box
    var bothTypes= typeArray[2].concat(" (" , subType , ")");
    AddAttribute("npc-type",bothTypes,charID);
    
    //*****ATTRIBUTE SCORES***************
    
    //find the element in the data array that the title "Statistics" occurs in
    var statsElementNumber = data.indexOf("STATISTICS");
    
    //the actual attribute scores are in the element after the heading
    var stats = data[statsElementNumber+1];
    stats = stats.split(",");
    
    //assign attribute scores by removing non numerical characters from the stats array elements
    var strength = stats[0].replace(/\D/g,"");
    var dexterity = stats[1].replace(/\D/g,"");
    var constitution = stats[2].replace(/\D/g,"");
    var intelligence = stats[3].replace(/\D/g,"");
    var wisdom = stats[4].replace(/\D/g,"");
    var charisma = stats[5].replace(/\D/g,"");
    
    // define attribute modifiers used in other sections
    var strMod = getAbilityMod(strength);
    var dexMod = getAbilityMod(dexterity);
    var conMod = getAbilityMod(constitution);
    var intMod = getAbilityMod(intelligence);
    var wisMod = getAbilityMod(wisdom);
    var chaMod = getAbilityMod(charisma);
    
    // place attribute scores in NPC sheet
    AddAttribute("STR-base",strength,charID);
    AddAttribute("DEX-base",dexterity,charID);
    AddAttribute("CON-base",constitution,charID);
    AddAttribute("INT-base",intelligence,charID);
    AddAttribute("WIS-base",wisdom,charID);
    AddAttribute("CHA-base",charisma,charID);
    
    //find and store initiative bonus, Senses
    var initArray = findString(data, "Init", true);
    initArray = initArray.split(",");
    var initiative = initArray[0];
    initiative = initiative.replace(/\D/g,"");
    var initBonus = initiative - dexMod;
    AddAttribute("init-misc",initBonus,charID);
    
    initArray.splice(0,1);
    initArray[0] = initArray[0].replace(" Senses ","");
    initArray.toString();
    AddAttribute("npc-senses",initArray,charID);
    
    
    //************ Auras ****************
    
    var aurasLine = findString(data, "Aura", true);
    if (aurasLine != null) 
    { 
        aurasLine = aurasLine.replace("Aura ","");
        AddAttribute("npc-aura",aurasLine,charID);
    }
    
    //*****AC Breakdown**************
    var acLine = findString(data, "AC ", true);
    var acBreakdown = getSubStr(acLine,"(",")" );
    acBreakdown = acBreakdown.slice(1);
    acBreakdown = stripString(acBreakdown,"-","+") //if there is a size or dex penalty with -, change to + for time being, remove later
    var acSeparate = acBreakdown.split("+");
    var acNumOnly = acBreakdown.split("+");
    acNumOnly = removeNonNumericFromArray(acNumOnly);
    var acSeparateNames = removeNumbersFromArray (acSeparate);
   
    var armorIndex = acSeparateNames.indexOf("armor");
    var shieldIndex = acSeparateNames.indexOf("shield");
    var deflectIndex = acSeparateNames.indexOf("deflection");
    var dodgeIndex = acSeparateNames.indexOf("dodge");
    var naturalIndex = acSeparateNames.indexOf("natural");
    var acSizeIndex = acSeparateNames.indexOf("size");
    //If the search found that armour in the breakdown, put that value in the 
    //NPC sheet and add the values used to acFromNamed in order to determine
    // the total miscellenous armour bonus
    var acFromNamed = 0
        
    if (armorIndex != -1) {
    AddAttribute("armor-acbonus",acNumOnly[armorIndex],charID);
    acFromNamed = acFromNamed + acNumOnly[armorIndex];
    }
    
    if (shieldIndex != -1) {
    AddAttribute("shield-acbonus",acNumOnly[shieldIndex],charID);
    acFromNamed = acFromNamed + acNumOnly[shieldIndex];
    }
    if (deflectIndex != -1) {
    AddAttribute("AC-deflect",acNumOnly[deflectIndex],charID);
    acFromNamed = acFromNamed + acNumOnly[deflectIndex];
    }
    if (dodgeIndex != -1) {
    AddAttribute("AC-dodge",acNumOnly[dodgeIndex],charID);
    acFromNamed = acFromNamed + acNumOnly[dodgeIndex];
    }
    if (naturalIndex != -1) {
    AddAttribute("AC-natural",acNumOnly[naturalIndex],charID);
    acFromNamed = acFromNamed + acNumOnly[naturalIndex];
    }
    var natural = acNumOnly[naturalIndex];


    //puts any other AC bonuses than the named into MISC
    var ac = 0;
    
    if (sizeNum >= 0) {
        ac = sumArray(acNumOnly)+10; // if creature has + size AC bonus then simple
    }
    else {
        ac = sumArray(acNumOnly)+10 + 2*sizeNum; 
        // if creature has - size AC bonus then the array summed incorrectly (added instead of subtracted) 
        // correct by subtracting double
    }
    if (dexMod <= 0){
        ac = ac + dexMod*2; //correct for negative dex bonuses
    }
    // every other type of AC bonus than those named reports to misc
    var miscAC = ac - (10 + acFromNamed +sizeNum + dexMod);
    AddAttribute("AC-misc",miscAC,charID);
    
    
    //****************  Health  ************************
    var hpArray = findString(data, "hp ", true);
    hpArray = stripStringRegEx(hpArray, "(", ")");
    hpArray = hpArray.split(" ");
    var HP = hpArray[1];
    AddAttribute("NPC-HP",HP,charID);
    AddAttribute("npc-hd-misc",HP,charID);
    
    //****************  Saves  ************************
    var savesLine = findString(data, "Fort ", true);
    var savesArray = savesLine.split(",");
    savesNum = removeNonNumericFromArray(savesArray);
    
    var fortitude = savesNum[0];
    var reflex = savesNum[1];
    var willpower = savesNum[2];
    
    var savesArrayExtra = savesLine.split(",");
    savesArrayExtra.splice(0,3);
    
    var fortBonus = fortitude - conMod;
    var refBonus = reflex - dexMod;
    var willBonus = willpower - wisMod;
    
    AddAttribute("Fort-misc",fortBonus,charID);
    AddAttribute("Ref-misc",refBonus,charID);
    AddAttribute("Will-misc",willBonus,charID);
    AddAttribute("Save-notes",savesArrayExtra,charID);
    
    //************ Defensive Abilities ****************
    
    var defenseLine = findString(data, "Defensive Abilities", true);
    if (defenseLine != null) 
    { 
        defenseLine = defenseLine.replace("Defensive Abilities ","");
        AddAttribute("npc-defensive-abilities",defenseLine,charID);
    }
    //**************** Weaknesses *******************
    var weakLine = findString(data, "Weaknesses ", true);
    if (weakLine != null) 
    { 
        var weaknesses = weakLine.replace("Weaknesses ","");
        AddAttribute("weaknesses",weaknesses,charID);
    }
    //************ Damage Resistance  ****************
    var drLine = findString(data, "DR ", true);
    if (drLine != null) { 
        var damageResist = drLine.match(/DR (\d+\/\w+)/);
        AddAttribute("DR",damageResist[1],charID);   
    }
    //************ Immunities  **********************
    var immuneLine = findString(data, "Immune ", true);
    if (immuneLine != null) {
        immuneLine = immuneLine.replace(/SR .*/,"");
        var immune = immuneLine.match(/Immune (.*);*?/)
        AddAttribute("immunities",immune[1],charID);   
    }
    //************ Spell resistance  ****************
    var srLine = findString(data, "SR ", true);
    if (srLine != null) {
        var sr = srLine.match(/SR (\d+)/)
        AddAttribute("SR",sr[1],charID);   
    }
    //*************** Speed ***********************
    
        var speedStr = findString(data, "Speed ", true);
        
    if (speedStr != null) 
    {   //make two arrays, one with values and the other with speed types
        speedStr = speedStr.replace("Speed ","");
        var maneuver = getSubStr(speedStr, "(", ")");
        var speedArray = stripStringRegEx(speedStr, "(", ")");
        speedArray = speedArray.replace(/ft./g,"");
        speedArray = speedArray.replace(/ /g,"");
        var speedNums = speedArray.split(",");
        var speedTypes = speedArray.split(",");
        speedNums = removeNonNumericFromArray (speedNums);
        speedTypes = removeNumbersFromArray (speedTypes);
        
        //determine the index of each speed type (-1 if type not found)
        var burrowSpeedIndex = speedTypes.indexOf("burrow");
        var climbSpeedIndex = speedTypes.indexOf("climb");
        var flySpeedIndex = speedTypes.indexOf("fly");
        var swimSpeedIndex = speedTypes.indexOf("swim");
        
        AddAttribute("speed-base",speedNums[0],charID);
        
        if (burrowSpeedIndex != -1) {
        AddAttribute("speed-burrow",speedNums[burrowSpeedIndex],charID);
        }
        if (climbSpeedIndex != -1) {
        AddAttribute("speed-climb",speedNums[climbSpeedIndex],charID);
        }
        if (flySpeedIndex != -1) {
        AddAttribute("speed-fly",speedNums[flySpeedIndex],charID);
        AddAttribute("speed-fly-maneuverability",maneuver,charID);
        }
        if (swimSpeedIndex != -1) {
        AddAttribute("speed-swim",speedNums[swimSpeedIndex],charID);
        }
    }
    
    //*********** Space, Reach & Reach Notes **********
    // find line containing "Space"
    var space = "",
        reach = "";
        
    var reachLine = findString(data, "Space ", true);
    if (reachLine != null) 
    {
    //get subtype before destroying string
    var reachNotes = getSubStr(reachLine, "(", ")");
    var reachArray = stripStringRegEx(reachLine, "(", ")");
    var reachNums = reachArray.split(",");
    reachNums = removeNonNumericFromArray (reachNums);
    space = reachNums[0];
    reach = reachNums[1];


    AddAttribute("reach-notes",reachNotes,charID);
    }
    else
    {
    space = 5
    reach = 5
    }
    AddAttribute("space",space,charID);
    AddAttribute("reach",reach,charID);
    
    //*********** BASE ATTACK BONUS **************
    
    var babArray = findString(data, "Base Atk", true);
    babArray = babArray.split(",");
    
    var babNum = removeNonNumericFromArray(babArray);
    AddAttribute("class-0-bab",babNum[0],charID);       


    //************ MELEE ATTACK *******************
    //*********************************************
    // ParseAttack syntax:
    // ParseAttack(text to search, string to look for, attack bonus, damage bonus, reach, repeat number, charID)
    var numMeleeAttacks = parseAttack(data,"Melee", (babNum[0] + strMod), strMod, reach, 0, charID);


    //************ RANGED ATTACK *******************
    //**********************************************
    var numRangedAttacks = parseAttack(data,"Ranged",(babNum[0] + dexMod),0, reach,numMeleeAttacks,charID);
    
    //*********** Special Attacks ****************
    var specAtks = findString(data, "Special Attacks", true);
    if (specAtks != null) {
    specAtks = specAtks.replace("Special Attacks ","");
    AddAttribute("npc-special-attacks",specAtks,charID);
    }
    
    //*********** Before and During Combat ************
    var beforeCombat = findString(data, "Before Combat", true);
    if (duringCombat != null) {
    beforeCombat = beforeCombat.replace("Before Combat ","");
    AddAttribute("npc-before-combat",beforeCombat,charID);
    }
    
    var duringCombat = findString(data, "During Combat", true);
    if (duringCombat != null) {
    duringCombat = duringCombat.replace("During Combat ","");
    AddAttribute("npc-during-combat",duringCombat,charID);
    }
    
    //**************** FEATS **********************
    var feats = findString(data, "Feats ", true);
    if (feats!= null){
    feats = feats.replace("Feats ","");
    feats = feats.trim();
    feats = feats.split(",");
    for (i=0; i<feats.length ; i++) {
        AddAttribute("repeating_feat_"+i+"_name",feats[i],charID);
    }
    }
    //****************SKILLS************************
    
    var skillsLine = findString(data, "Skills", true);
    if (skillsLine != null) 
    { 
        skillsLine = skillsLine.replace("Skills ","");
        skillsLine = stripString(skillsLine, " +", "");
        var skillsBrackets = getSubStr(skillsLine,"(", ")");
        var skillsNoBrackets = stripStringRegEx(skillsLine,"(", ")");
        
        var skillsTotal = skillsNoBrackets.split(",")
        var skillsName = skillsNoBrackets.split(",")
        
        skillsTotal = removeNonNumericFromArray (skillsTotal);
        skillsName = removeNumbersFromArray (skillsName);
        
        //make the arrays that are used to find out the relevant skill attribute
        var skillsAll = "Acrobatics,Appraise,Bluff,Climb,Craft,Diplomacy,Disable Device,Disguise,Escape Artist,Fly,Handle Animal,Heal,Intimidate,Knowledge (Arcana),Knowledge (Dungeoneering),Knowledge (Engineering),Knowledge (Geography),Knowledge (History),Knowledge (Local),Knowledge (Nature),Knowledge (Nobility),Knowledge (Planes),Knowledge (Religion),Linguistics,Perception,Perform,Profession,Ride,Sense Motive,Sleight of Hand,Spellcraft,Stealth,Survival,Swim,Use Magic Device";
       skillsAll = skillsAll.split(",");
        var modsAll = "dex,int,cha,str,int,cha,dex,cha,dex,dex,cha,wis,cha,int,int,int,int,int,int,int,int,int,int,int,wis,cha,wis,dex,wis,dex,int,dex,wis,str,cha";
        modsAll = modsAll.split(",");
          
          //go through each skill, determine its total score, then determine the total ranks using the relevant modifer.
            for (var i = 0; i < skillsTotal.length; i++) 
        {   var nameStr = ""
            if (skillsName[i] != "Craft" && skillsName[i] != "Knowledge" && skillsName[i] != "Perform" && skillsName[i] != "Profession") 
            {
            var skillAtr = modsAll[skillsAll.indexOf(skillsName[i])]; //look up the corresponding attribute for the current skill
            var mod = 0;
            switch (skillAtr) 
                {
                case "str":
                    mod = strMod;
                    break;
                case "dex":
                    mod = dexMod;
                    break;
                case "con":
                    mod = conMod;
                    break;
                case "int":
                    mod = intMod;
                    break;
                case "wis":
                    mod = wisMod;
                    break;
                case "cha":
                    mod = chaMod;
                    break;
                }
            
            var skillRank = skillsTotal[i] - mod;
            nameStr = stripString(skillsName[i], " ", "-");
            var fullNameStr = nameStr.concat("-misc");
            //output skill to char sheet
            AddAttribute(fullNameStr,skillRank,charID);
            
            }
        
        }
        
        
    }
    
    
    //********** LANGUAGES, SQ, GEAR*****************
    
    var languageStr = findString(data, "Languages", true);
    if (languageStr != null) {
    languageStr = languageStr.replace("Languages ","");
    AddAttribute("languages",languageStr,charID);
    }
    
    var sqStr = findString(data, "SQ ", true);
    if (sqStr != null) {
    sqStr = sqStr.replace("SQ ","")
    AddAttribute("SQ",sqStr,charID);
    }


    var gearStr = findString(data, "Combat Gear", true);
    if (gearStr != null) {
    gearStr = gearStr.replace("Combat Gear ","");
    gearStr = gearStr.split("Other Gear");
    AddAttribute("npc-combat-gear",gearStr[0],charID);
    AddAttribute("npc-other-gear",gearStr[1],charID);
    }
   
    
    //****************  sets Token Name, Health, linked AC ******************
    
    token.set("name", tokenName||'');
    token.set("showname", true);
    token.set("bar3_value", HP||0);
    token.set("bar3_max", HP||0);
    token.set("bar2_value", ac||0);
    token.set("showplayers_bar3", true);
    token.set("status_blue",true);
    
    }
});