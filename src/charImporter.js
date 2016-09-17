/*
Script to help import characters and mobs for pathfinder from Hero Labs or from the Pazio PRD website.
usage 

!CreateMob y/n y/n

the first y/n determines whether the skills will be displayed as abilities.  They still will be parsed but will just be turned off
in the acility bar.

the second y/n to determine if the emotes/tells are GM or player emotes/tells.  If Y is passed in player emotes are used.


Create a token
Copy the text from the pazio mob site or from hero labs File/Output Hero Stat block, Plain Text, StatBlock, Current Hero Only, Copy
Paste the test into the token's GM Notes.
Run the macro !CreateMob ?{ShowSkills}
Enter y if you want skills to be displayed

The script  will then parse the notes extracting init, perception, melee attacks, ranged attacks, special attacks, spells, 
spell like abilities and skills, create a character sheet, attach it to the token and set them up as abilities for the token.

This script uses commas and semicolons as delimiters so beaware of how you use them.
The first line is always the tokens name.
If there is a link in the ability skill it will be added at the end of the macro as a gm whisper with the link you can
launch.

Try to keep the formatting simple.  I have not decoded all the format codes so if you send it something
that is unkownn to the script it may crash or generate garbage.

*/
var gEMString = "/emas @{selected|token_name}";
var gGMTell = "/w GM ";

//looks for an occurence of str in the array strArray, if found returns that element
function findString(strArray, str, doConcat) 
{
    var fullStr = "";
    for (var i = 0; i < strArray.length; i++) 
    {
        if (doConcat)
        {
            if (strArray[i].indexOf(str) != -1)
            {
                var ct = 0;
                for (var k = i; k < strArray.length; k++) 
                {
                    var splitStr = strArray[k].split(" ");
                    if (splitStr[splitStr.length-1].indexOf("and") != -1)
                    {
                        for (var j = 0; j < splitStr.length-1; j++)
                        {
                            fullStr = fullStr + " "+ splitStr[j];
                        }
                        fullStr = fullStr + " , ";
                        ct++;
                    }
                    else if (ct >= 1)
                    {
                        fullStr = fullStr + strArray[k];
                        
                        return fullStr;
                    }
                    else
                    {
                        if (fullStr == "")
                            return strArray[i];
                        else
                            return fullStr;
                    }
                }
            }
        }
        else if (strArray[i].indexOf(str) != -1) 
        {
            return strArray[i];
        }
    }
    return null;
};

//removes all occurence of removeStr in str and replaces them with replaceWidth
function stripString(str, removeStr, replaceWith) {
    while (str.indexOf(removeStr) != -1) {
        str = str.replace(removeStr, replaceWith);
    }
    return str;
};

/* removes anything between the the character a and b in incstr, basicaly a*b */
function stripStringRegEx(incstr, a, b) {
    var str = incstr;
    done = false;

    while (done == false) {
        if (str.length == 0) {
            done = true;
        }
        var ai = str.indexOf(a);
        if (ai == -1) {
            done = true
        }
        else {
            var bi = ai + 1;
            while (str[bi] != b) {
                bi++;
                if (bi >= str.length) {
                    done = true;
                    break;
                }
            }
            if (bi < str.length) {
                bi++;
                var subst = str.substring(ai, bi);
                var tempstr;
                if (subst != null) {
                    tempstr = str.replace(subst, "");
                    str = tempstr;
                }
            }
        }
    }
    return str;
};

/* returns the string between two characters a/b */
function getSubStr(str, a, b) {
    var ai = -1;
    var bi = -1;
    for (var i = 0; i < str.length; i++) {

        if (ai == -1 && str[i] == a) {
            ai = i;
        }
        else if (bi == -1 && str[i] == b) {
            bi = i;
            break;
        }
    }
    if (ai != -1 && bi != -1) {
        var retStr = str.substring(ai + 1, bi);
        return retStr;
    }
    return null;
}

/* just cleans up the string leaving text and hyperlinks */
function cleanUpString(strSpecials) 
{
    strSpecials = stripString(strSpecials, "%20", " ");
    strSpecials = stripString(strSpecials, "%22", "\"");
    strSpecials = stripString(strSpecials, "%29", ")");
    strSpecials = stripString(strSpecials, "%28", "(");
    strSpecials = stripString(strSpecials, "%2C", ",");


    var inParens = 0;
    for (var i = 0; i < strSpecials.length; i++)
    {
        if (strSpecials[i]=="(")
            inParens++;
        if (strSpecials[i]==")")
            inParens--;
            
        if ((inParens > 0) && (strSpecials[i]==","))
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
};

/* removes all links for the string */
function removeLinks(str) 
{
    return stripStringRegEx(str, "<", ">");
};

//retrieves all the links in the str
function getLinks(str) 
{
    var linkArray = new Array();
    var done = false;
    while (done == false)
    {
        var webAddress = getSubStr(str, "\"", "\"");
        if (webAddress == null)
        {
            done = true;
        }
        else
        {
            linkArray.push(webAddress);
            str = str.replace("\""+webAddress+"\"","");
        }
    } 
    return linkArray;
}

//adds an attribute to the character sheet, str is the string to parse, attr is the name of the attribute you are looking for
//charID is the characters ID
function addAttr(str, attr, charID) {
    for (var j = 0; j < str.length; j++) {
        var testString = removeLinks(str[j]);

        if (testString.indexOf(attr) != -1) {
            var splitStr = testString.split(",");
            for (var i = 0; i < splitStr.length; i++) {
                if (splitStr[i].indexOf(attr) != -1) {
                    
                        var valStr = splitStr[i];
                        
                        valStr = valStr.replace(attr, "");                        
                        valStr = valStr.replace("+", "");
                        valStr = valStr.trim();
                        var valStrArray = valStr.split(" ");
                        valStr = valStrArray[0];

                        createObj("attribute", {
                            name: attr,
                            current: valStr,
                            max: valStr,
                            characterid: charID
                        });
                        return;
                    }
                
            }
        }
    }
};

//this just generates one string from an array of links
function getLinkStringFromArray(linkArray)
{
   var abilityLink = "";
    if (linkArray.length > 0)
    {
        
        for (var i = 0; i < linkArray.length; i++)
        {
            abilityLink = abilityLink + "\n"+gGMTell + linkArray[i];        
        }
    }
    return abilityLink;
};

//this takes a string and removes the dice text and replaces it with actual inline rolls
function addDiceRoll(str)
{
    if (str == "") return;
    if (str == null) return;
    str = str.replace("("," ( ");
    str = str.replace(")"," ) ");
    
    var splitArray = str.split(" ");
    var retStr = "";
    if (splitArray == null) return;
    
    for (var i = 0; i < splitArray.length; i++)
    {
        var testStr = splitArray[i];
        if (testStr.search(/[0-9]d[0-9]/) != -1)
        {            
            retStr = retStr + " [[ " + testStr + " ]]";
        }
        else
        {
            retStr = retStr + " " + testStr;
        }
    }
    return retStr;
};

function parseAndOr( inStr,  testStr,  altReplaceStr)
{
    if (inStr == null) return null;
    var done = false;
	while (!done)
	{
		var index = inStr.indexOf(testStr);
		if (index == -1)
		{
			done = true;
		}
		else
		{
			var foundParen = false;
			for (var i = index; i >= 0; i--)
			{
				if (inStr[i] == "(")
				{
					foundParen = true;
					break;
				}
    			else if (inStr[i] == ")")
				{
					break;
				}                
			}
			if (foundParen)
				inStr = inStr.replace(testStr,altReplaceStr);
			else
				inStr = inStr.replace(testStr,",");
		}
	}
    return inStr;
};

//adds an attack/dmg ability to the character
function addAbility(str, charID, isRanged) {
    if (str == null) return;
    
    //strip links
    var linkArray = getLinks(str);
    str = removeLinks(str);
    var abilityLink = getLinkStringFromArray(linkArray);
    
    //extract damage
    var dmgStr = getSubStr(str, "(",")");
    str = str.replace("("+dmgStr+")","");
    var dmgDescr = "";
    var critStr = "";
    if (dmgStr != null && dmgStr != "") {
        

        var dmgStrArray = dmgStr.split(" ");
        dmgStr = "";
        var addToDescr = false;
        for (var i = 0; i < dmgStrArray.length; i++) {
            if (addToDescr == false && dmgStrArray[i].search(/[0-9]/) == -1) {
                addToDescr = true;
            }
            if (addToDescr) {
                dmgDescr = dmgDescr + " " + dmgStrArray[i];
            }
            else {
                dmgStr = dmgStr + " " + dmgStrArray[i];
            }
        }
        if (dmgStr != "")
        {
            if (dmgStr.indexOf("/") != -1)
            {
                var dmgCheckCritArray = dmgStr.split("/");
                dmgStr = dmgCheckCritArray[0];
                critStr = "\n"+gEMString+" Crit Range " + dmgCheckCritArray[1];
            }
        }
        
        dmgDescr = addDiceRoll(dmgDescr)
        
    }
    //    log(dmgStr);
    var attackStr = str;
    attackStr = stripString(attackStr, ">", "");
    
    attackStr = attackStr.split(" ");
    var plusStr = "";
    var attackName = "";
    for (var i = 0; i < attackStr.length; i++)
    {
        if (attackStr[i].indexOf("+") != -1)
        {
            plusStr = attackStr[i];
        }
        else
        {
            attackName = attackName + " " + attackStr[i];
        }
            
    }
    var firstPlusIndex = attackStr.indexOf("+");
    //extract name
    
    var attackPlus = "";
    if (plusStr != "") {        
        plusStr = plusStr.replace(" ", "");
        plusStr = plusStr.replace("+", "");
        attackPlus = plusStr.split("/");
    }
    else
    {
        attackPlus = new Array("0");
    }
    
    attackName = attackName.trim();

     var attacKPrefix = "ATK"
    if (isRanged)
        attacKPrefix = "RNG"
    for (var i = 0; i < attackPlus.length; i++) {
        var abilityName = attacKPrefix + ": " + attackName;
        if (attackPlus.length > 1) {
            abilityName = attacKPrefix + (i + 1) + ":" + attackName;
        }
        attackPlus[i] = attackPlus[i].replace("+", "");
        createObj("ability", {
            name: abilityName,
            description: "",
            action: gEMString + " " + abilityName + " Attacks = [[1d20 + " + attackPlus[i] +"  + @{selected|bar1} " +"]]"+ critStr + abilityLink,
            istokenaction: true,
            characterid: charID
        });
    }

    var damageName = "DMG:" + attackName
    if (dmgStr == "")
        createObj("ability", {
            name: damageName,
            description: "",
            action: gEMString + " " + attackName + " Damage = " + dmgDescr,
            istokenaction: true,
            characterid: charID
        });    
    else
    {
        if (dmgDescr == null) dmgDescr = "";
        
        createObj("ability", {
            name: damageName,
            description: "",
            action: gEMString+" " + attackName + " Damage = [[" + dmgStr  +"  + @{selected|bar1} " + "]] " + dmgDescr,
            istokenaction: true,
            characterid: charID
        });
    }
};

on('chat:message', function (msg) {



    if (!(msg.selected && msg.selected.length > 0)) return; // Make sure there's a selected object

    var token = getObj('graphic', msg.selected[0]._id);
    if (token.get('subtype') != 'token') return; // Don't try to set the light radius of a drawing or card

    if (msg.type == 'api' && msg.content.indexOf('!CreateMob') !== -1) {
        var showSkills = false;
        var testSkillPass = msg.content.split(" ");
        if (testSkillPass.length > 1 && testSkillPass[1]!="")
        {
            if ( (testSkillPass[1].indexOf("Y") != -1) || (testSkillPass[1].indexOf("y") != -1))
                showSkills = true;
        }   

        if (testSkillPass.length > 2 && (testSkillPass[2]=="y" || testSkillPass[2]=="Y"))
        {
			gEMString = "/em ";
			gGMTell = "/em  ";
		}		
		else
		{
			gEMString = "/emas @{selected|token_name} ";
			gGMTell = "/w GM ";
		}

log("Start creating char")        
        var originalGmNotes = token.get('gmnotes');
        var gmNotes = token.get('gmnotes');


        gmNotes = stripString(gmNotes, "%3C/table%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h1%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h2%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h3%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h4%3E", "%3Cbr");
        
        //break the string down by line returns
        var data = gmNotes.split("%3Cbr");

        //clean out all other data except text and hyperlinks
        for (var i = 0; i < data.length; i++) {
            data[i] = cleanUpString(data[i]);
            if (data[i][0]=">")
            {
                data[i] = data[i].replace(">","");
            }
        }
        
        for (var i = 0; i < data.length; i++) {
            if (data[i] != null)
                data[i] = data[i].trim();
        }

        var nameField = data[0];
        var names = nameField.split("CR");
        var mobName = names[0].trim();



        log("Creating char " + names[0]);
        var character = createObj("character", {
            avatar: token.get("imgsrc"),
            name: mobName,
            bio: token.get('gmnotes'),
            gmnotes: token.get('gmnotes'),
            archived: false
        });
        var charID = character.get('_id');
        token.set("represents", charID);


        //add our basic attributes
        var attribList = new Array("Init", "Perception", "AC", "touch", "flat-footed", "hp", "Fort", "Ref", "Will");
        var attribMaceroList = new Array(
                                    "Init",
                                    gGMTell+" Initiative roll (+@{Init}) = [[1d20 + @{Init} &{tracker}]]",
                                    "Perception",
                                    gGMTell+" Perception roll (+@{Perception}) = [[1d20 + @{Perception}]]",
                                    "F",
                                    gEMString+" Fort check  = [[1d20 + @{Fort}]]",
                                    "R",
                                    gEMString+" Reflex check  = [[1d20 + @{Ref}]]",
                                    "W",
                                    gEMString+" Will check  = [[1d20 + @{Will}]]"
                                     );
                                     
        while (attribList.length > 0) {
            var attrib = attribList[0];
            attribList.shift();
            addAttr(data, attrib, charID);
        }
                

        var hp = findObjs({ _type: "attribute", name: "hp", _characterid: charID })[0];

        token.set("name", mobName);
        token.set("showname", true);
        token.set("bar1_value", 0);
        token.set("bar2_value", 0);
        token.set("bar3_value", hp.get("current"));
    
        for (var i = 0; i < attribMaceroList.length / 2; i++) {
            createObj("ability", {
                name: attribMaceroList[i * 2],
                description: "",
                action: attribMaceroList[i * 2 + 1],
                istokenaction: true,
                characterid: charID
            });

        }
        
        log("Done adding basic macros ");
        
        var meleeStr = findString(data, "Melee",true);
        
        if (meleeStr != null) 
        {
//            meleeStr = stripString(meleeStr, " or ", " , ");
//            meleeStr = stripString(meleeStr, " and ", " , ");
			meleeStr = parseAndOr(meleeStr, "or ", " | ");
			meleeStr = parseAndOr(meleeStr, "and ", " & ");
            meleeStr = meleeStr.replace("Melee ", "");
            var meleeStrArray = meleeStr.split(",");
            for (var i = 0; i < meleeStrArray.length; i++) {
                addAbility(meleeStrArray[i], charID, false);
            }
        }

        log("Done adding melee ");

       var rangeStr = findString(data, "Range",true);
        
        if (rangeStr != null) 
        {
			rangeStr = parseAndOr(rangeStr, "or ", " | ");
			rangeStr = parseAndOr(rangeStr, "and ", " & ");
//            rangeStr = stripString(rangeStr, " or ", " , ");
//            rangeStr = stripString(rangeStr, " and ", " , ");
            rangeStr = rangeStr.replace("Ranged ", "");
            var rangeStrArray = rangeStr.split(",");
            for (var i = 0; i < rangeStrArray.length; i++) {
                addAbility(rangeStrArray[i], charID, true);
            }
        }

        log("Done adding range ");

        //        var strSpecials = stripForAttacks(data,"Special",false);   
        var strSpecials = findString(data, "Special Attack",false);
        if (strSpecials != null) 
        {
			strSpecials = parseAndOr(strSpecials, "or ", " | ");
			strSpecials = parseAndOr(strSpecials, "and ", " & ");
            strSpecials = strSpecials.replace("Special Attacks", "");
            strSpecials = strSpecials.replace("Special Attack", "");
            strSpecials = strSpecials.trim();

            if (strSpecials[0] == ">")
                strSpecials = strSpecials.replace(">", "");

            var strSpecialArray = strSpecials.split(",");

            for (var i = 0; i < strSpecialArray.length; i++) 
            {
                var strSpecialAttacks = strSpecialArray[i];
                
                var linkArray = getLinks(strSpecialAttacks);
                strSpecialAttacks = removeLinks(strSpecialAttacks);
                var ablityLink = getLinkStringFromArray(linkArray);

                var spaceIndex = strSpecialAttacks.indexOf(" ");
                var strSpecialName = strSpecialAttacks.substr(0, spaceIndex);
                
                if (strSpecialName == "")
                    strSpecialName = strSpecialAttacks;
                
                strSpecialName =  stripStringRegEx(strSpecialName,"(",")");
                
                strSpecialAttacks = addDiceRoll(strSpecialAttacks);
                
                createObj("ability", {
                    name: strSpecialName,
                    description: "",
                    action: gEMString + " " + strSpecialAttacks + ablityLink,
                    istokenaction: true,
                    characterid: charID
                    });
            }

        }

        log("Done adding special attacks ");

        var firstSpecial = -1;
        var lastSpecial = -1;
        for (var i = 0; i < data.length; i++) 
        {
            var id = data[i].search("Spell-Like Abilities");
            
            if (id != -1) {
                firstSpecial = i + 1;
            }
            
            id = data[i].search("Spell-like Abilities");
            if (id != -1) {
                firstSpecial = i + 1;
            }            
            
            if (firstSpecial != -1 && data[i].search("Statistics") != -1) {
                lastSpecial = i - 1;
                break;
            }
            if (firstSpecial != -1 && data[i].search("STATISTICS") != -1) {
                lastSpecial = i - 1;
                break;
            }                        
            if (firstSpecial != -1 && data[i].search("Spells Known") != -1) {
                lastSpecial = i - 1;
                break;
            }  
            if (firstSpecial != -1 && data[i].search("Spells Prepared") != -1) {
                lastSpecial = i - 1;
                break;
            } 
            if (firstSpecial != -1 && data[i].search("----------") != -1) {
                lastSpecial = i - 1;
                break;
            }             
        }
        if (firstSpecial != -1) {
            for (var i = firstSpecial; i <= lastSpecial; i++) 
            {

                var str = data[i];
                var strHtlmArray = str.split("014");

                var howOftenHtml = strHtlmArray[0];
                howOftenHtml = howOftenHtml.replace(">", "");
                var abilityHtmlArray = "";
                if (strHtlmArray[1] != null)
                    abilityHtmlArray = strHtlmArray[1].split(",");  
                    
                for (j = 0; j < abilityHtmlArray.length; j++) 
                {
                    
                    var abilStr = abilityHtmlArray[j];
                    
                    var linkArray = getLinks(abilStr);
                    abilStr = removeLinks(abilStr);
                    var ablityLink = getLinkStringFromArray(linkArray);
                    
                    createObj("ability", {
                        name: howOftenHtml + ":" + abilStr,
                        description: "",
                        action: gEMString + " " + abilStr + ablityLink,
                        istokenaction: true,
                        characterid: charID
                        });
                        
                }
                
            }
        }
        log("Done adding special Abilities ");    
        
        firstSpecial = -1;
        lastSpecial = -1;
        for (var i = 0; i < data.length; i++) 
        {            
            var id = data[i].search("Spells Known");            
//log(id);            
//log(data[i]);            
            if (id != -1) {
                firstSpecial = i + 1;
            } 
            else
            {
                id = data[i].search("Spells Prepared");
                if (id != -1) {
                    firstSpecial = i + 1;
                }
            }
            if (firstSpecial != -1 && data[i].search("Statistics") != -1) {
                lastSpecial = i - 1;
                break;
            }
            if (firstSpecial != -1 && data[i].search("STATISTICS") != -1) {
                lastSpecial = i - 1;
                break;
            }            
            if (firstSpecial != -1 && data[i].search("Spell-Like Abilities") != -1) {
                lastSpecial = i - 1;
                break;
            }   
            if (firstSpecial != -1 && data[i].search("-----") != -1) {
                lastSpecial = i - 1;
                break;
            }             
        }

        if (firstSpecial != -1) {
            for (var i = firstSpecial; i <= lastSpecial; i++) 
            {

                var str = data[i];
                if (str.indexOf("014") == -1) continue;
        
                var strHtlmArray = str.split("014");

                var howOftenHtml = strHtlmArray[0];
                howOftenHtml = howOftenHtml.replace(">", "");
                var abilityHtmlArray = strHtlmArray[1].split(",");
        
                for (j = 0; j < abilityHtmlArray.length; j++) 
                {
                    
                    var abilStr = abilityHtmlArray[j];
                    
                    var linkArray = getLinks(abilStr);
                    abilStr = removeLinks(abilStr);
                    var ablityLink = getLinkStringFromArray(linkArray);
                    
                    createObj("ability", {
                        name: howOftenHtml + ":" + abilStr,
                        description: "",
                        action: gEMString+" " + abilStr + ablityLink,
                        istokenaction: true,
                        characterid: charID
                        });
                        
                }                
            }
        }
log("Done adding spells");    

        var strSkills = findString(data, "Skills",false);
        if (strSkills != null) 
        {
            strSkills = strSkills.replace("Skills", "");
            strSkills = strSkills.trim();
            if (strSkills[0] == ">")
                strSkills = strSkills.replace(">", "");

            var strSkillArray = strSkills.split(",");
            
            for (var i = 0; i < strSkillArray.length; i++) 
            {
                var strSkill = strSkillArray[i];
                if ( (strSkill.indexOf("Racial") != -1) && (strSkill.indexOf("Modifiers") != -1)  )
                    break;
                if (strSkill.indexOf("Perception") != -1) 
                    continue;
                var linkArray = getLinks(strSkill);
                strSkill = removeLinks(strSkill);
                var ablityLink = getLinkStringFromArray(linkArray);

                var skillArray = strSkill.split(" ");
                
                strSkill = "";
                var strBonus = "";
                if (skillArray.length == 1)
                {
                    skillArray = skillArray[0].split("+");                
                    if (skillArray.length == 2)
                    {
                        strSkill = skillArray[0];
                        strBonus = skillArray[1];
                    }
                    else
                    {
                        strSkill = skillArray[0];
                    }
                }
                else
                {
                    for (var j = 0; j < skillArray.length; j++)
                    {
                        if ( (skillArray[j].search(/[0-9]/) != -1) && (strBonus == ""))
                        {
                            strBonus = skillArray[j];                        
                        }
                        else
                        {
                            strSkill = strSkill + " " +skillArray[j];
                        }
                    }
                }
                strBonus = strBonus.replace("+","");
                    
                createObj("ability", {
                    name: strSkill,
                    description: "",
                    action: gEMString+" " +strSkill +"[[ 1d20 +"+ strBonus  + " ]]" + ablityLink,
                    istokenaction: showSkills,
                    characterid: charID
                    });
                    
            }
            
            log("Done adding skills "); 
        }          
    }
    log("***************Done************");
}
);