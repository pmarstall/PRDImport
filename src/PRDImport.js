/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/* global _, findObjs */

var PRDImport = (function(){
    
    var attackNum = 0;
    
    /*
     * Run the import routine to pull a PRD NPC/Monster
     * format into the character sheet.
     * 
     * @param {type} msg - The imput from the chat
     * @returns {undefined}
     */
    var doImport = function(msg){
        log('doImport Started');
        var token;
        
        // reset the attack count
        attackNum=0;
        
        // Check to see if it's a token or not
        if (!(msg.selected && msg.selected.length > 0)) {
			sendFeedBack("No token selected for creature creation");
			return;
		}
                
        // Right now, we're not going to try and handle multiple imports
        if (msg.selected.length > 1) {
			sendFeedBack( 'Multiple Icons Selected (cannot handle that yet!)');
                        return;
		}
                
        // Let's start the good stuff
        _.each(msg.selected, function(e) {	
            token = getObj('graphic', e._id);
            //debug("ID: "+ e._id + "");
            //debug("Object subtype: "+token.get('_subtype'));
            try{
                var parsedData;
                var charSheet;
                var charID;
                var creName;
                var foundObj;
                // Send the token to be parsed
                parsedData = parseAll(token);
                  
                // The first thing we need to find is the creature name
                creName = parseName(parsedData);
                debug('Starting Import of '+creName);
                log('Importing: '+ creName);
                
                charSheet = getCharacterSheet(creName, token);
                
                //debug("Char Sheet ID: " + charSheet.get('_id'));
                charID = charSheet.get('id');
                
                // Import the header information
                parseHeader(parsedData, charID);
                
                // Import Defense information
                parseDefense(parsedData, charID);
                
                // Import the Offense information
                parseOffense(parsedData, charID);
                
                // TODO: Tactics (last thing)
                
                // Import Statistics
                parseStatistics(parsedData, charID);
                
                // Special abilities
                parseSpecialAbilities(parsedData, charID);
    
                // Associate the token with the character sheet if needed
                if (!token.get('represents')){
                    token.set('represents',charID);
                }
                
                sendFeedBack("Import Complete.");
                
            }catch (err){
                sendFeedBack("ERROR during token parsing: "+err);
            }
                  
        }, this);
    };
    
    /*
     * Parse out the text of the gmnotes
     * 
     * @contribuitor Andy W.
     * 
     * @param {token} token to be processed
     * @returns {undefined}
     */
    var parseAll = function(token) {
        var data;
        var rawData;
        
        rawData = token.get("gmnotes");
        //debug('RAW: ' + rawData);
        if (!rawData) 
                {throw "no token notes";}
        data = rawData.split(/%3Cbr%3E|\\n|<br>/);
        //clean out all other data except text, starting with the last line
        for (var i = data.length; i >= 0; i--) {
                if (data[i]) {
                        data[i] = cleanString(data[i]).trim();
                        if (!data[i].match(/[^\s]/)) {
                                data.splice(i,1); 
                        }
                }
                //debug("Data: " +data[i]);
        }
        return data;
    };
    
    /*
     * Parse out the creature name
     * 
     * @contribuitor Andy W.
     * 
     * @param {type} data
     * @returns {unresolved}
     */
    var parseName = function(data) {
        /* names are tricky as we delimit on CR, last occurance of CR 
        which has numbers after it*/
        var namefield = data[0];
        var delimiter_idx =namefield.lastIndexOf("CR");
        var fuzzyfield = namefield.substring(delimiter_idx,namefield.length);
        if ((delimiter_idx <= 0) || !(fuzzyfield.match(/\d+|—/g)))
                {delimiter_idx = namefield.length;}
        var name = namefield.substring(0,delimiter_idx);
        
        // PRD text for the names tends to be ALL CAPS, so we'll
        // make it lowercase and the Capitalize the first letter
        name = name.trim().toLowerCase();
        name = name.charAt(0).toUpperCase() + name.slice(1);
        
        return name;
    };
    
    /*
     * Pull out the creature summary information and insert it into
     * the character sheet
     * 
     * @param {type} data
     * @param {type} charID
     * @returns {undefined}
     */
    var parseHeader = function(data, charID){
        var lineStart =0;
        var lineEnd;
        var lineLoc;
        var retval;
        
        log('* Parse Header');
        lineEnd = getLineByName('DEFENSE', data, 0, data.length);
        if(!lineEnd){lineEnd=data.length;}
        
        // Get the CR
        for(i = lineStart; i<lineEnd; i++){
            var lineLoc = data[i].lastIndexOf("CR");
            if(lineLoc>0){
                retval = data[i].substring(lineLoc+2, data[i].length);
                setAttribute("npc-cr", charID, cleanNumber(retval));
                lineLoc=0;
            }
        }
        
        // Get the XP
        lineLoc = getLineByName('XP', data, lineStart, lineEnd);
        if(lineLoc>0){setAttribute('npc-xp', charID, 
            getValueByName('XP', data[lineLoc], ['\r', '\n']));}
        
        // Alignment, size, type
        lineLoc = getAlignLine(data, lineStart, lineEnd);
        if (lineLoc !== -1){
            // Divvy up the various values
            var alignData;
            var typeData;
            alignData = getValueArray(data[lineLoc], ' ', null);


            // The alignment should be the first value
            setAttribute('alignment', charID, alignData[0].trim());

            // The size should be the second value, but it needs conversion
            setAttribute('size', charID, parseSize(alignData[1]));

            // Set the type and subtype
            for (i=2; i<alignData.length; i++){
                typeData = typeData + " " + alignData[i];
            }
            setAttribute('npc-type', charID, typeData);
        }
    };
    
    /*
     * Find the size of the creature
     * 
     * @param {type} data - the data to be parsed
     * @returns {String|undefined}
    */
    var parseSize = function(charSize) {
        // The Pathfinder character sheet stores the size as an integer behind
        // the pick-list which corresponds to the AC adjustment
        var retval = 0; 
        charSize = charSize.toLowerCase();
        charSize = charSize.trim();
        switch(charSize) {
                case 'medium':
                        retval = 0; 
                        break;
                case 'large':
                        retval = -1; 
                        break;
                case 'huge':
                        retval = -2; 
                        break;
                case 'gargantuan':
                        retval = -4; 
                        break;
                case 'colossal':
                        retval = -8; 
                        break;
                case 'small':
                        retval = 1; 
                        break;
                case 'tiny':
                        retval = 2; 
                        break;
                case 'dimminutive':
                        retval = 4; 
                        break;
                case 'fine':
                        retval = 8; 
                        break;
                default:
                        retval = 0; 
                        break; 
        }
        
        return retval; 
    };
    
    /*
     * Parse out the DEFENSES block from the PRD
     * 
     * @param {type} data
     * @param {type} charID
     * @returns {undefined}
    */
    var parseDefense = function(data, charID){
        var lineStart = getLineByName('DEFENSE', data);
        var lineEnd = getLineByName('OFFENSE', data);
        var lineNum;
        if (lineEnd === -1){lineEnd=data.length;}
        log('* Parse Defense Block');
        debug('Parse Defense!');
        // AC 
        lineNum = getLineByName('AC', data, lineStart, lineEnd);
        parseArmorClass(data[lineNum], charID);
        
        // Hit Points
        lineNum = getLineByName('hp', data, lineStart, lineEnd);
        parseHitPoints(data[lineNum], charID);
        
        // Parse out the various resistances, if they exist.
        // For simplicity, we're just going to assume that it's the line
        // before OFFENSE, and it's not the saves.  Worst case, it doesn't
        // find anything.
        lineNum = lineEnd-1;
        parseResists(data[lineNum], charID);
    };
    
    /*
     * Parse out the relevant AC data and insert it into the char sheet
     * 
     * @param {type} dataLine - the string that includes the AC data
     * @param {type} charID
     * @returns {undefined}
     */
    var parseArmorClass = function(dataLine, charID){
        var parenAC;
        var acData;
        var acTypes;
        var acValues;
        
        // The AC will be largely calculated by the character sheet, taking
        // the size and DEX into account already.  We need to pull out
        // some of the parenthetical values like dodge, natural, armor, etc.
        if(dataLine.indexOf('(') !== -1){
            parenAC = getParentheticalValue(dataLine);

            acData = getValueArray(parenAC, ',');
            acTypes = removeNumbersFromArray(acData);
            acValues = removeNonNumericFromArray(acData);
     
            for(i=0; i<acData.length; i++){
                // In the AC line, the plusses are BEFORE the value, not after
                // which is annoying.  And there is little choice but to check
                // for all the individual possibilities
                switch(acTypes[i].toLowerCase()){
                    case '+ armor':
                        setAttribute('armor3-acbonus', charID, acValues[i]);
                        break;
                    case '- armor':
                        setAttribute('armor3-acbonus', charID, acValues[i]*(-1));
                        break;
                    case '+ natural':
                        setAttribute('AC-natural', charID, acValues[i]);
                        break;
                    case '- natural':
                        setAttribute('AC-natural', charID, acValues[i]*(-1));
                        break;
                    case '+ dodge':
                        setAttribute('AC-dodge', charID, acValues[i]);
                        break;
                    case '- dodge':
                        setAttribute('AC-dodge', charID, acValues[i]*(-1));
                        break;
                    case '+ deflection':
                        setAttribute('AC-deflect', charID, acValues[i]);
                        break;
                    case '- deflection':
                        setAttribute('AC-deflect', charID, acValues[i]*(-1));
                        break;
                    case '+ shield':
                        setAttribute('shield3-acbonus', charID, acValues[i]);
                        break;
                    case '- shield':
                        setAttribute('shield3-acbonus', charID, acValues[i]*(-1));
                        break;
                    case '+ dex':
                    case '- dex':
                    case '+ size':
                    case '- size':
                        // Already handled
                        break;
                    default:
                        // Something is here that we didn't anticipate;
                        // warn the user
                        sendFeedBack('Check the AC section.  Unable to handle '
                                + acData[i] + '.');
                        break;
                }
                
            }
        }else{
            log('No AC modifiers found');
        }
    };
    
    /*
     * Parse out the hit points, hit dice and insert into the character sheet
     * 
     * @param {type} data - the data line with the HP info
     * @param {type} charID
     * @returns {undefined}
    */
    var parseHitPoints = function(data, charID){
        if(!data){return;}
        var hpDataRaw;
        var hitDiceData;
        var hpCalcData;
        var hpArray;
        var hpCalcArray;
        var hitDiceNum;
        var hitDiceAmt;
        var hitDicePlus;
        
        // To start with, grab the parenthetical value
        var hpDataRaw = getParentheticalValue(data);
        
        // Split the data out by semi-colon; creatures with levels
        // often have this case, and we need to account for it
        hpArray = getValueArray(hpDataRaw, ';');

        if (hpArray.length>1){
            hitDiceData = hpArray[0];
            hpCalcData = hpArray[1];
        }else{
            hitDiceData = '';
            hpCalcData = hpArray[0];
        }
        
        // Now that we have the hpCalcData, we split IT by the '+'
        hpCalcArray = getValueArray(hpCalcData, '+');

        if(hpCalcArray.length>2){
            // Looks like there are some character levels in there
            hitDiceNum = getHitDiceNum(hpCalcArray[1]);
            hitDiceAmt = getHitDiceValue(hpCalcArray[1]);
            if(hitDiceNum && hitDiceAmt){
                setAttribute('npc-hd-num2', charID, hitDiceNum);
                setAttribute('npc-hd2', charID, hitDiceAmt);
            }
            hitDicePlus = cleanNumber(hpCalcArray[2]);
            
        }else{
            // Appears to be just the standard NPC hit dice
            hitDicePlus = hpCalcArray[1];
        }
        hitDiceNum = getHitDiceNum(hpCalcArray[0]);
        hitDiceAmt = getHitDiceValue(hpCalcArray[0]);
        if(hitDiceNum && hitDiceAmt){
            setAttribute('npc-hd-num', charID, hitDiceNum);
            setAttribute('npc-hd', charID, hitDiceAmt);
        }
        if(hitDicePlus){
            setAttribute('npc-hd-misc', charID, hitDicePlus);
        }
        
        // The Hit Dice for NPCs are calculated from the above
        // data by the sheet, so we're good there.
    };
    
    /*
     * Pull out any resists, weaknesses, SR, DR, etc.
     * 
     * @param {type} dataLine
     * @param {type} charID
     * @returns {undefined}
     */
    var parseResists = function(dataLine, charID){
        var immuneVal = getValueByName('Immune', dataLine, ';');
            if(immuneVal){setAttribute('immunities', charID, immuneVal);}
        var drVal = getValueByName('DR', dataLine, ';');
            if(drVal){setAttribute('DR', charID, drVal);}
        var srVal = getValueByName('SR', dataLine, ';');
            if(srVal){setAttribute('SR', charID, cleanNumber(srVal));}
        var resistVal = getValueByName('Resist', dataLine, ';');
            if(resistVal){setAttribute('resistances', charID, resistVal);}
        var weakVal = getValueByName('Weaknesses', dataLine, ';');
            if(weakVal){setAttribute('weaknesses', charID, weakVal);}
    };
    
    /*
     * Parse the all-important OFFENSE block
     * 
     * @param {type} data
     * @param {type} charID
     * @returns {undefined}
    */
    var parseOffense = function(data, charID){
        var lineStart = getLineByName('OFFENSE', data, 0, data.length);
        var lineEnd = getLineByName('TACTICS', data, lineStart, data.length);
        var lineLoc;
        
        if(!lineEnd){getLineByName('STATISTICS', data, lineStart, data.length);}
        
        log('* Parse Offense Block');
        debug('Parsing Offense!');
        
        // Speeds
        var speedData = getValueByName('Speed', 
                    data[getLineByName('Speed', data, lineStart, lineEnd)],
                    ';');
        parseSpeed(speedData, charID);
        
        // There are lots of things that can go wrong in the Offense
        // parsing, so we'll try/catch and toss a warning to the user
        // if something goes south.
        try{
            // Melee
            lineLoc = getLineByName('Melee', data, lineStart, lineEnd);
            if(lineLoc>=0){
                // Looks like there is a melee attack.  Get the data.
                var aryMelee = getValueArray(data[lineLoc], ',', 'Melee');
                var txtDetails;
                for(i=0; i<aryMelee.length; i++){
                    txtDetails = parseAttack(aryMelee[i]);
                    if(txtDetails){
                        txtDetails=txtDetails + 'Type Melee;';
                        setAttack(txtDetails, charID);
                        attackNum++;
                    }
                }
            }

            // TODO: Special attacks
            lineLoc = getLineByName('Special Attacks', data, lineStart, lineEnd);
            if(lineLoc>0){
                var spAtk = getValueArray(data[lineLoc], '\n', 'Special Attacks');
                setAttribute('npc-special-attacks', charID, spAtk);
            }

            // Ranged
            lineLoc = getLineByName('Ranged', data, lineStart, lineEnd);
            if(lineLoc>=0){
                // Looks like there is a melee attack.  Get the data.
                var aryMelee = getValueArray(data[lineLoc], ',', 'Ranged');
                var txtDetails;
                for(i=0; i<aryMelee.length; i++){
                    txtDetails = parseAttack(aryMelee[i]);
                    if(txtDetails){
                        txtDetails=txtDetails + 'Type Ranged;';
                        setAttack(txtDetails, charID);
                        attackNum++;
                    }
                }
            }
        }catch(err){
            sendFeedBack('Issue in parseOffense: '+err);
            sendFeedBack('Check the attacks, they are probably bad!');
        }
        
        
        // TODO: Spell-Like Abilities
        
        // TODO: Spells Prepared
    };
    
    
    /*
     * Parse out the speed data
     * 
     * @param {type} data - The speed Line minus "Speed"
     * @param {type} charID
     * @returns {undefined}
     */
    var parseSpeed = function(data, charID){
        var speedVal;
        // Get rid of the units
        data = data.replace(/ft./g,"");
        
        var spdArray = data.split(',');

        // The first value, we hope, will be the base speed
        speedVal = cleanNumber(spdArray[0]);
        if(speedVal){setAttribute('speed-base', charID, cleanNumber(spdArray[0]));}
        
        // Go through and try and find any of the other types
        speedVal = getValueByName('fly', data, ',');
        if(speedVal){setAttribute('speed-fly', charID, cleanNumber(speedVal));}
        speedVal = getValueByName('burrow', data, ',');
        if(speedVal){setAttribute('speed-burrow', charID, cleanNumber(speedVal));}
        speedVal = getValueByName('climb', data, ',');
        if(speedVal){setAttribute('speed-climb', charID, cleanNumber(speedVal));}
        speedVal = getValueByName('swim', data, ',');
        if(speedVal){setAttribute('speed-swim', charID, cleanNumber(speedVal));}  
    };
    
    /*
     * Given a line with all the attack information, create a better-formatted
     * string with all the details annotated
     * 
     * @returns {txtDetails} - the split-out details
     */
    var parseAttack = function(txtAttack){
        var txtDetails;
        var txtDamage;
        var txtAttackName;
        var txtAttackPlus = [0];
        var txtRoll;
        var txtDamagePlus =[0];
        var txtDieNum;
        var txtHitDie;
        var txtCritLow=[20];
        var txtCritMult=[2];
        
        // Get the text before the parentheses
        txtAttackName = txtAttack.split('(')[0].split('/')[0].replace(/\+\d+/g,'').trim();
        txtAttackPlus = txtAttack.match(/[+]\d+/);
        if(!txtAttackPlus){txtAttackPlus=[0];}
        //debug(txtAttackName);
        
        txtDetails = 'Name '+ txtAttackName + 
                '; AtkPlus ' + txtAttackPlus[0] + ';';
                
        // Get the parenthetical damage information
        txtDamage = getParentheticalValue(txtAttack);
        if(txtDamage){
            // If it exists, it should be in XdY+Z format... but not always,
            // and it may have a '/' followed by the crit info
            txtDamage= txtDamage.split('/');
            // Pull out the die roll
            txtRoll = txtDamage[0].match(/\d+d\d+/);
            //debug('txtDamage[0] ' + txtDamage[0].match(/\d+d\d+/));
            //debug(txtRoll[0]);
            txtDieNum = getHitDiceNum(txtRoll[0]);
            txtHitDie = getHitDiceValue(txtRoll[0]);
            if(txtDamage[0].match(/[+]/)){txtDamagePlus = txtDamage[0].match(/[+]\d+/);}
            if(txtDamage[0].match(/[-]/)){txtDamagePlus = txtDamage[0].match(/[-]\d+/);}
            if(!txtDamagePlus){txtDamagePlus[0]=0;}
            txtDetails = txtDetails + 'Dice '+ txtDieNum +'; HD '+ txtHitDie + 
                    '; DamPlus ' + txtDamagePlus[0] + ';';
            // Check to see if there are any critical values
            if(txtDamage[1]){
                //debug('txtDamage[1] '+txtDamage[1]);
                // Check for a lower bound on the crit
                txtCritLow = txtDamage[1].match(/^\d+/);
                txtCritMult = txtDamage[1].match(/x\d+/);
                
            }
            if(!txtCritLow){txtCritLow = [20];}
            if(!txtCritMult){txtCritMult = [2];}
            // TODO: Figure out why this doesn't work
            //txtCritMult[0] = cleanNumber(txtCritMult[0]);
           
            txtDetails = txtDetails + 'CritLow ' + txtCritLow[0] + 
                    '; CritMult ' + txtCritMult[0] + ';';
        }
   
        //debug('txtDetails: ' + txtDetails);
        return txtDetails;
    };
    
    /*
     * Parse out the statistic block, which includes the typical
     * characteristics, the BAB, and other data
     * 
     * @param {type} data
     * @param {type} charID
     * @returns {nothing}
    */
    var parseStatistics = function(data, charID){
        var lineStart = getLineByName('STATISTICS', data, 0, data.length);
        var lineEnd = data.length;
        var lineLoc;
        debug('Parse Statistics');
        log('* Parse Statistics Block');
        
        // core attribute fields
        var primeAttr = ["Str","Dex","Con","Int","Wis","Cha"];
        var minorAttr = ["Base Atk","CMB","CMD"];
        
        // Get Core Attributes
        lineLoc = getLineByName('Str',data,lineStart,lineEnd);
        parsePrimeAttributes(primeAttr, data[lineLoc], [';',','], charID);
        
        // Get the BAB
        lineLoc = getLineByName('Base Atk', data, lineStart, lineEnd);
        setAttribute('class-0-bab', charID, 
            cleanNumber(getValueByName('Base Atk', data[lineLoc],';')));
            
        // Feats
        lineLoc = getLineByName('Feats', data, lineStart, lineEnd);
        parseFeats(data[lineLoc], charID);
        
        // Languages
        lineLoc = getLineByName('Languages', data, lineStart, lineEnd);
        if(lineLoc>0){
            setAttribute('languages', charID, 
                getValueByName('Languages', data[lineLoc], '\n'));
        }
        
        // Special Qualities
        lineLoc = getLineByName('SQ', data, lineStart, lineEnd);
        if(lineLoc>0){
            setAttribute('SQ', charID, 
                getValueByName('SQ', data[lineLoc], '\n'));
        }
        
        // TODO: Gear
        
    };
    
    /*
     * Parse out the core attributes (STR, etc.) and insert them into the sheet
     * 
     * @param {type} primeAttr - the array of prime attribute names to look for
     * @param {type} termChars - any delimiters to parse on
     * @param {type} dataLine - the text of the attributes line
     * @param {type} charID - character ID
     * @returns {undefined}
    */
    var parsePrimeAttributes = function(primeAttr, dataLine, termChars, charID){
        var attrVal;
        var attrMod;
        for(i=0; i<primeAttr.length; i++){
            attrVal=getValueByName(primeAttr[i],dataLine,termChars);
            attrMod = primeAttr[i].toUpperCase().trim()+'-base';
            setAttribute(attrMod, charID, cleanNumber(attrVal));
        }
    };
    
    /*
     * Pull the feats out and add them to the character sheet
     * 
     * @param {type} dataLine
     * @param {type} charID
     * @returns {undefined}
    */
    var parseFeats = function(dataLine, charID){
        if(!dataLine){return;}
        var aryFeats = getValueArray(dataLine, ',', 'Feats');
        var featName;
        for(i=0; i<aryFeats.length; i++){
            featName = aryFeats[i].trim();
            // Add the info to the character sheet
            setAttribute('repeating_feat_$'+[i]+'_name', charID, featName);
            setAttribute('repeating_feat_$'+[i]+'_short-description', charID, featName);
        }
    };
    
    
    /*
     * Parse the Special Abilities section
     * 
     * @param {type} data
     * @param {type} charID
     * @returns {undefined}
    */
    var parseSpecialAbilities = function(data, charID){
        var lineStart = getLineByName("SPECIAL", data, 0, data.length);
        var lineEnd = data.length;
        var spcLoc;
        var spcTraitNum=0;
        
        if (!lineStart){
            log('Unable to find SPECIAL ABILITIES section.');
            return;
        }
        log('* Parse Special Abilities Block');
        debug('Parse Special Abilities!');
            
         
        // Cycle through the section looking for one of the special ability
        // abbreviations (Su, Ex, Sp)
        for(i=lineStart; i<lineEnd; i++){
            spcLoc = data[i].indexOf('(Su)');
            if(spcLoc !== -1){
               setSpecialAbility(data[i], spcLoc, spcTraitNum, charID); 
               spcTraitNum++;
            } 
            spcLoc = data[i].indexOf('(Ex)');
            if(spcLoc !== -1){
               setSpecialAbility(data[i], spcLoc, spcTraitNum, charID); 
               spcTraitNum++;
            }
            spcLoc = data[i].indexOf('(Sp)');
            if(spcLoc !== -1){
               setSpecialAbility(data[i], spcLoc, spcTraitNum, charID); 
               spcTraitNum++;
            } 
        }
    };
    
    /*
     * A helper fucntion to actually insert the special ability into
     * the Racial Traits list
     * 
     * @param {type} data
     * @param {type} txtLoc
     * @param {type} charID
     * @returns {undefined}
    */
    var setSpecialAbility = function(dataLine, txtLoc, index, charID){
        setAttribute('repeating_racial-trait_$'+index+'_name',
                        charID,
                        dataLine.substring(0, txtLoc).trim());
        setAttribute('repeating_racial-trait_$'+index+'_short-description',
                        charID,
                        dataLine.substring(0, txtLoc).trim());
        setAttribute('repeating_racial-trait_$'+index+'_description',
                        charID,
                        dataLine.trim());
    };
    
    /*
     * Send the user some feedback through the ROLL20 Chat
     * 
     * @param {type} txt
     * @returns {undefined}
     */
    var sendFeedBack = function(txt){
        sendChat('PRD Utilities', txt);
    };
    
    
    /*
     * Return the attribute object (if any)
     * 
     * @param {type} name
     * @param {type} charId
     * @returns {unresolved}
     */
    var getAttribute = function(attributeName, charID) {
            return  findObjs({
                            _type: "attribute",
                            name: attributeName,
                            _characterid: charID
            })[0];
    };
    
    /*
     * Insert the details of the attack into the character sheet
     * 
     * @param {type} data
     * @returns {undefined}
     */
    var setAttack = function(data, charID){
        var attrPre = 'repeating_weapon_$'+attackNum+'_';
        
        setAttribute(attrPre+'name', charID, getValueByName('Name', data, ';'));
        setAttribute(attrPre+'total-attack', charID, 
                        cleanNumber(getValueByName('AtkPlus', data, ';')));
        setAttribute(attrPre+'damage-dice-num', charID, 
                        cleanNumber(getValueByName('Dice', data, ';')));
        setAttribute(attrPre+'damage-die', charID, 
                        cleanNumber(getValueByName('HD', data, ';')));
        setAttribute(attrPre+'crit-target', charID,
                        cleanNumber(getValueByName('CritLow', data, ';')));
        setAttribute(attrPre+'crit-multiplier', charID, 
                        cleanNumber(getValueByName('Name', data, ';')));
        setAttribute(attrPre+'total-damage', charID, 
                        cleanNumber(getValueByName('DamPlus', data, ';')));
        // Set the attack type
        var atkType= getValueByName('Type', data, ';').trim();
        switch(atkType){
            case 'Melee':
                setAttribute(attrPre+'attack-type', charID, '@{attk-melee}');
                setAttribute(attrPre+'damage-ability', charID, '@{STR-mod}');
                break;
            case 'Ranged':
                setAttribute(attrPre+'attack-type', charID, '@{attk-ranged}');
                setAttribute(attrPre+'damage-ability', charID, '@{DEX-mod}');
                break;
        }
        
        
    };
    
    /*
     * Update a attribute in the character sheet with the provided value(s)
     * 
     * @param {type} attributeName - The attribute to be changed
     * @param {type} charSheet - the character to be updated
     * @param {type} normValue - the value to be inserted
     * @param {type} maxValue - the maximum value (if not provided, wont be set
     * @returns {undefined}
     */
    var setAttribute = function(attributeName, charID, normValue, maxValue){

        if (normValue === undefined )
            {
                log(attributeName + " has returned an undefined value.");
                sendFeedBack("Error on setAttribute: " + attributeName + " attribute"+
                    "This attribute has been ignored.");
                return;
            }
            
        // See if the attribute already exists
        if (getAttribute(attributeName, charID)){
                // The attribute already exists, so update it
                getAttribute(attributeName, charID).set(attributeName, normValue);
                log('Updated ' + attributeName + ": " + normValue);
            }else{
                // The attribute doesn't exist, make it
                createObj("attribute", {
                            name: attributeName,
                            current: normValue,
                            characterid: charID
                    });
                
                log('Created ' + attributeName + ": " + normValue);
                return;
            }

    };
    
    /*
     * Intercept the chat message from the Roll20 desktop
     * 
     * @param {type} msg
     * @returns {undefined}
     */
    var handleChatMessage = function(msg) {
		var importName = "!PRDImport";
                var refreshName = "!PRDRefresh";
                var spellName = "!PRDSpell";
		var msgTxt = msg.content;
                
                // Import
                if ((msg.type === "api")
		&& (msgTxt.indexOf(importName) !== -1)
		&& playerIsGM(msg.playerid)) {
                    log('**********PRDImport called at '+Date.now());
                    doImport(msg);
                }
                
                // Refresh
                if ((msg.type === "api") 
		&& (msgTxt.indexOf(refreshName) !== -1)
		&& playerIsGM(msg.playerid)) {
                    log('**********PRDRefresh called at '+Date.now());
                    
                }
                
                // Spell import
                if ((msg.type === "api") 
		&& (msgTxt.indexOf(spellName) !== -1)
		&& playerIsGM(msg.playerid)) {
                    log('**********PRDSpell called at '+Date.now());   
                }
    };
    
    /*
     * Send a notice to the UI.  Should be disabled before Prod
     * 
     * @param {type} txt
     * @returns {undefined}
     */
    var debug = function(txt){
        sendChat("Debug", txt);
    };
    
    
    /*
     * Find a line in the parsed data set that contains the strName.
     * Return the index of that line.
     * 
     * @param {type} strName - the string we're looking for
     * @param {type} aryLines - the data array
     * @param {type} locStart - first line to start with (0 by default)
     * @param {type} locEnd - last line to search (last by default)
     * @returns {undefined|integer}
    */
    var getLineByName = function(strName, aryLines, locStart, locEnd) {
        if (!strName || !aryLines) 
                {return undefined;}
        if (!locStart) 
                {locStart = 0;}
        if (!locEnd) 
                {locEnd = aryLines.length;}
        var retval;

        for (var i = locStart; i < locEnd; ++i) {
                if (aryLines[i].indexOf(strName) !== -1) {
                        retval = i;
                        break;
                }
        }
        return retval;
    }; 
    
    
    /*
     * Given a line, name, and terminators return the value, value is
     * the the trimed text after the name and before the terminator. 
     * 
     * @param {type} strName - the name ofd the value
     * @param {type} strLine - the full line
     * @param {type} termChars - the delimiters
     * @returns {value}
     */
    var getValueByName = function(strName, strLine, termChars) {
        if (!strLine || !strName || !termChars) {return undefined;}
        var retval;
        var loc = -1;
        var locTerm = strLine.length;
      
        if ((loc=strLine.indexOf(strName)) !== -1) {
                for (var i = 0; i < termChars.length; ++i) {
                        var tmp = strLine.indexOf(termChars[i],loc);
                        if ((tmp !== -1) && (tmp < locTerm)) 
                                {locTerm = tmp;}
                }
                if (locTerm > loc) {
                        locTerm = getParenSafeTerm(
                                strLine,loc,locTerm,termChars);
                        retval = strLine.substring(loc+strName.length,locTerm);
                }
        }
        return retval;
    };
    
    /*
     * Splits the values of the line into individual, trimmed
     * strings in an array
     * 
     * @param {type} dataLine - the line of data to be parsed
     * @param {type} delimiterText - the delimiter
     * @param {type} headerText - the presumed first word (e.g., 'Feats')
     * @returns {string array}
    */
    var getValueArray = function(dataLine, delimiterText, headerText){
        if (!dataLine || !delimiterText){return;}
        
        var splitText = dataLine.split(delimiterText);
        
        // Take out the headerText from the first element
        if (headerText && splitText[0].indexOf(headerText) !== -1){
            splitText[0] = splitText[0].slice(headerText.length);
        }
        
        // Trim the values, just to be neat
        for (i=0; i<splitText.length; i++){
            splitText[i] = splitText[i].trim();
        }
        
        return splitText;
    };
    
    /*
     * Get the location of the closest terminator that is paren safe. If there
     * are parens. Probably a faster way exists using regex and exec..
     *  
     * @param {type} strLine
     * @param {type} start
     * @param {type} end
     * @param {type} termChars
     * @returns {strLine.length|@var;newTerm}
    */
    var getParenSafeTerm = function(strLine, start, end, termChars) {
        var newTerm = -1;
        var inParen = 0;
        var closeLoc = -1;
        var i; 

        if (start >= end) 
                {return end;}
        for (i = start; i < strLine.length; ++i) {
            if (strLine[i] === '(')
                    {inParen++;}
            else if (strLine[i] ===')')
                    {inParen--;}
            if (i >= end) {
                    if (inParen <= 0) 
                            {return end;}
                    else if (inParen > 0) 
                            {break;}
            }
        }
        if (inParen <= 0) 
            {return end;}

        // if we found we're in parens
        closeLoc = strLine.indexOf(')',start);
        end = strLine.length;
        if (closeLoc === -1) 
            {return end;}
        for (i = 0; i < termChars.length; ++i) {
            if (-1 === (newTerm=strLine.indexOf(termChars[i],closeLoc)))
                    {newTerm = strLine.length;}
            else if (newTerm < end)
                    {end = newTerm;}
        }
        return end;
    };
    
    /*
     * Given a string, return the substring between the first parentheses
     * 
     * @param {type} dataLine
     * @returns {String}
     */
    var getParentheticalValue= function(dataLine){
        // First, check to see if there are any aprentheses
        if(!dataLine.indexOf('(') || !dataLine.indexOf(')')){return '';}
        return dataLine.substring(dataLine.indexOf('(')+1, dataLine.indexOf(')'));
    };
    
    
    /*
     * Given a term like '8d12', return the '8'
     * 
     * @param {type} data
     * @returns {undefined}
    */
    var getHitDiceNum = function(data){
        if(!data){return 0;}
        var dNum = data.indexOf('d');
        if(!dNum){return 0;}
        return cleanNumber(data.substring(0, dNum));
    };
   
    /*
     * Given a term like '8d12', return the '12'
     * 
     * @param {type} data
     * @returns {undefined}
    */
    var getHitDiceValue = function(data){
        if(!data){return 0;}
        var dNum = data.indexOf('d');
        if(!dNum){return 0;}
        return cleanNumber(data.substring(dNum+1, data.length));
    };
    
    /*
     * The line in the header that contains the alignment also contains the
     * size, the type and subtype and some other useful data.  Rather
     * than searching for it a dozen times, find it once and move on.
     * 
     * @param {type} data
     * @returns {string}
    */
    var getAlignLine = function(data, lineStart, lineEnd){
        var retval=0;
        retval = getLineByName('N ', data, lineStart, lineEnd);
        if (!retval) {retval = getLineByName('NG ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('NE ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('LG ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('LE ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('LN ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('CG ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('CE ', data, lineStart, lineEnd);}
        if (!retval) {retval = getLineByName('CN ', data, lineStart, lineEnd);}

        return retval;
    };
    
    var getCharacterSheet = function(txtName, token){
        var charSheet;
        // See if the creature has an existing character sheet              
        if (findObjs({
                _type: "character",
                name: txtName
            }).length > 0) {
                // A character sheet already exists, so use it
                debug("Character sheet already exists");
                foundObj = findObjs({
                    _type: "character",
                    name: txtName
                });
                _.each(foundObj, function(obj){
                    charSheet = obj;
                });
            }else{
                // There's no existing character sheet, do make one
                debug("No character sheet exists.  Creating");
                charSheet = createObj("character", {
                    avatar: token.get("imgsrc"),
                    name: txtName,
                    gmnotes: '',
                    archived: false,
                    inplayerjournals: '',
                    controlledby: ''
                });
            }
        return charSheet;
    };
   
    /*
     * Take out any non-numerical characters from a string
     * 
     * @param {string} numIn
     * @returns {number}
    */
    var cleanNumber = function(numIn){
       return numIn.replace(/\D/g,"");
    };
    
    /*
     * Cleans the string preserving select special characters and dropping the
     * remainder.
     * 
     * @author Andy W.
     * @contributor Ken L.
     * @param {string} strSpecials - String to be CLEANSED WITH FIRE
    */
    var cleanString = function(strSpecials) {
        strSpecials = stripString(strSpecials, "%20", ' ');
        strSpecials = stripString(strSpecials, "%22", '"');
        strSpecials = stripString(strSpecials, "%29", ')');
        strSpecials = stripString(strSpecials, "%28", '(');
        strSpecials = stripString(strSpecials, "%2C", ',');
        strSpecials = stripString(strSpecials, "%42", '');
        strSpecials = stripString(strSpecials, "*", '');
        strSpecials = stripString(strSpecials, '\n', '');
        strSpecials = stripString(strSpecials, '%3Cbr', '');

        strSpecials = stripString(strSpecials, "%09", '	');
        strSpecials = stripString(strSpecials, "%3C", '<');
        strSpecials = stripString(strSpecials, "%3E", '>');
        strSpecials = stripString(strSpecials, "%23", '#');
        strSpecials = stripString(strSpecials, "%3A", ':');
        strSpecials = stripString(strSpecials, "%3B", ';');
        strSpecials = stripString(strSpecials, "%3D", '=');
        strSpecials = stripString(strSpecials, "%D7", '×');
        strSpecials = stripString(strSpecials, "%u2018", '');
        strSpecials = stripString(strSpecials, "%u2019", '');
        strSpecials = stripString(strSpecials, "%u2013", '-');
        strSpecials = stripString(strSpecials, "%u2014", '—');
        strSpecials = stripString(strSpecials, "%u201C", '“');
        strSpecials = stripString(strSpecials, "%u201D", '”');


        while (strSpecials.search(/%../) !== -1) {
                strSpecials = strSpecials.replace(/%../, "");
        }

        strSpecials = strSpecials.replace(/<[^<>]+>|<\/[^<>]+>/g,'');

        return strSpecials;
    };
    
    /** removes all occurence of removeStr in str and replaces them with 
     * replaceWidth
     * 
     * @author Andy W.
     * @param {type} str - full string
     * @param {type} removeStr - substring to be removed
     * @param {type} replaceWith - substring to insert
    */
    var stripString = function(str, removeStr, replaceWith) {
           while (str.indexOf(removeStr) !== -1) {
                   str = str.replace(removeStr, replaceWith);
           }
           return str;
    };
    
    /*
     * Given an array, strip out all the numbers and return just
     * the text
     * 
     * @param {type} strArray
     * @returns {unresolved}
    */
     function removeNumbersFromArray (strArray)
     {
         return _.map(strArray,function(s){
             return s.replace(/\d+/g,'').trim();
         });
     }

     /*
      * Given an array, strip out all the text and return only
      * the numbers
      * 
      * @param {type} strArray
      * @returns {unresolved}
     */
     function removeNonNumericFromArray (strArray)
     {
         return _.map(strArray,function(s){
             return parseInt(s.replace(/\D+/g,''),10 || 0);
         });
     }
    
    return {
        /**
        * Register Roll20 handlers
        */
       registerAPI : function() {
               on('chat:message',handleChatMessage);
               log("PRDImport Initialized");
       },

       init: function() {
              
       }
    };
            
    
}());

on("ready", function() {
	'use strict'; 
	PRDImport.init();
	PRDImport.registerAPI();
});