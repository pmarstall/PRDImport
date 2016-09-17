/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var PFImport = (function(){
    
    var bonusEnum = Object.freeze({
        SCALAR: 1,
        SIGN: 2
    }); 
    
    /*
     * Start the import routine
     * @param {type} msg
     * @returns {undefined}
     */
    var doImport = function(msg) {
        var token;
        var content='';
        
        log('Starting Import');
        
        // Check to see if it's a token or not
        if (!(msg.selected && msg.selected.length > 0)) {
			feedBack("No token selected for creature creation");
			return;
		}
                
        // Right now, we're not going to try and handle multiple imports
        if (msg.selected.length > 1) {
			feedBack( 'Multiple Icons Selected (cannot handle that yet!)');
                        return;
		}
        
        // Let's start the good stuff
        _.each(msg.selected, function(e) {	
            token = getObj('graphic', e._id);
            //debugMsg("ID: "+ e._id + "");
            //debugMsg("Object subtype: "+token.get('_subtype'));
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
                
                log('Importing: '+ creName);
                
                // See if the creature has an existing character sheet              
                if (findObjs({
			_type: "character",
			name: creName
                    }).length > 0) {
                        // A character sheet already exists, so use it
                        debugMsg("Character sheet already exists");
                        foundObj = findObjs({
                            _type: "character",
                            name: creName
                        });
                        _.each(foundObj, function(obj){
                            charSheet = obj;
                        });
                    }else{
                        // There's no existing character sheet, do make one
                        debugMsg("No character sheet exists.  Creating");
                        charSheet = createObj("character", {
                            avatar: token.get("imgsrc"),
                            name: creName,
                            gmnotes: '',
                            archived: false,
                            inplayerjournals: '',
                            controlledby: ''
                        });
                    }
                //debugMsg("Char Sheet ID: " + charSheet.get('_id'));
                charID = charSheet.get('id');
                
                // Parse out the opening details from the header
                parseHeader(parsedData, charID);
                
                // Get the statistics block
                parseStatistics(parsedData, charID);
                
                // Get the Defense block
                parseDefense(parsedData, charID);
                
                // Get the Offense block
                parseOffense(parsedData, charID);
                
                // Get the special abilities
                parseSpecialAbilities(parsedData, charID);
                
                
                // Associate the token with the character sheet if needed
                if (!token.get('represents')){
                    token.set('represents',charID);
                }
                
                feedBack("Import Complete.");
                
            }catch (err){
                feedBack("ERROR during token parsing: "+err);
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
        var dispData = "";

        if (!token) {
                throw "No Token selected";
        }
        rawData = token.get("gmnotes");
        //debugMsg('RAW: ' + rawData);
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
                // debugMsg("Data: " +data[i]);
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
        which has numbers after it   use a regex which is shorter*/
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
        
        debugMsg("Name: " + name);
        
        return name;
    };
    
    /*
     * Get the messy stuff from the first few lines of the PRD
     * 
     * @param {string array} data - all the parsed data
     * @param {character sheet} charSheet - the char sheet to insert into
     * @returns {undefined}
     */
    var parseHeader = function(data, charID){
        // CR is tricky as it may be in the first line or on its own
        // line if the user was tidy, but it ought to be befor DEFENSE
        var defLine = getLineByName("DEFENSE", data);
        var crLoc;
        var alignLine;
        var alignData;
        var typeData='';
        log('Starting Header Block');
        debugMsg("Parse Header!");
        // Look for CR in each line
        for(i = 0; i<defLine; i++){
            var crLoc = data[i].lastIndexOf("CR");
            if(crLoc>0){
                retval = data[i].substring(crLoc+2, data[i].length);
                setAttribute("npc-cr", charID, cleanNumber(retval));
                crLoc=0;
            }
        }
        
        // Pull out the XP Value
        var crLoc = getLineByName("XP", data, 0, defLine);
        if (crLoc>0){
            retval = data[crLoc].substring(2, data[crLoc].length);
            setAttribute('npc-xp', charID, retval);
        }
        
        // Find the line with the alignement and whatnot
        alignLine = getAlignLine(data);
        
        // Divvy up the various values
        alignData = data[alignLine].split(' ');
        
        // The alignment should be the first value
        setAttribute('alignment', charID, alignData[0].trim());
        
        // The size should be the second value, but it needs conversion
        setAttribute('size', charID, parseSize(alignData[1]));
        
        // Set the type and subtype
        for (i=2; i<alignData.length; i++){typeData = typeData + " " + alignData[i];}
        setAttribute('npc-type', charID, typeData);
        
        // We won't set the initiative or perception yet since those will
        // get modified by other stats - we'll clean them up later
        
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
                        retval = 1; 
                        break;
                case 'huge':
                        retval = 2; 
                        break;
                case 'gargantuan':
                        retval = 4; 
                        break;
                case 'colossal':
                        retval = 8; 
                        break;
                case 'small':
                        retval = -1; 
                        break;
                case 'tiny':
                        retval = -2; 
                        break;
                case 'dimminutive':
                        retval = -4; 
                        break;
                case 'fine':
                        retval = -8; 
                        break;
                default:
                        retval = 0; 
                        break; 
        }
        
        return retval; 
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
        var line=0;
        var lineStartFnd = 0;
        var lineEndFnd = data.length;
        var termChars = [';',','];
        
        log('Starting Statistics Block');
        debugMsg('Parse Statistics!');
        
        // core attribute fields
        var primeAttr = ["Str","Dex","Con","Int","Wis","Cha"];
        var minorAttr = ["Base Atk","CMB","CMD"];
        lineStartFnd = getLineByName("STATISTICS",data);
	lineEndFnd = getLineByName("SPECIAL ABILITIES",data);
        
        // Get Core Attributes
        log('-- Str');
        line = getLineByName('Str',data,lineStartFnd,lineEndFnd);
        parsePrimeAttributes(primeAttr, data, termChars, line, lineStartFnd, charID);
                
        // Get the minor attributtes
        log('-- Base Atk');
        line = getLineByName('Base Atk',data,lineStartFnd,lineEndFnd);
        parseMinorAttributes(minorAttr, data, termChars, line, lineStartFnd, charID);
        
        // Pull out the feats and add each one of them as a new feat
        // in the character sheet
        log('-- Feats');
        line = getLineByName('Feats',data,lineStartFnd,lineEndFnd);
        parseFeats(data, line, charID);

        // Languages
        log('-- languages');
        line = getLineByName('Languages',data,lineStartFnd,lineEndFnd);
        parseLanguages(data[line], charID);

        // Special qualities
        line = getLineByName('SQ',data,lineStartFnd,lineEndFnd);
        parseSpecialQualities(data[line], charID);

        
        // Skills we have to leave for the update script due to 
        // problems with the character sheet updating
        
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
        if (!lineStart){
            throw 'DEFENSE block not found!';
        }
        log('Starting Defense Block');
        debugMsg('Parse Defense!');
        
        if(!lineEnd){lineEnd = data.length;}
        
        // Parse out the Armor Class line
        lineNum = getLineByName('AC', data, lineStart, lineEnd);
        parseArmorClass(data[lineNum], charID);
        
        // Parse out the Hit Point line
        lineNum = getLineByName('hp', data, lineStart, lineEnd);
        parseHitPoints(data[lineNum], charID);
        
        // We can't do the saves until the sheet is recalculated
        
        // Parse out the various resistances, if they exist.
        // For simplicity, we're jusdt going to assume that it's the line
        // before OFFENSE, and it's not the saves.
        lineNum = getLineByName('OFFENSE', data, 0, data.length)-1;
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
        if(!dataLine){return;}
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
                        feedBack('Check the AC section.  Unable to handle '
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
     * Parse out the various resistances, immunities and whatnot
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
        if (!lineStart){
            feedBack('Offense block is missing.  Something is horribly awry.');
            return;
        }
        log('Starting Offense Block');
        var lineEnd = getLineByName('STATISTICS', data, lineStart, data.length);
        debugMsg('Parsing Offense!');
        
        // Pull out the speed data
        var speedData = getValueByName('Speed', 
                    data[getLineByName('Speed', data, lineStart, lineEnd)],
                    ';');
        parseSpeed(speedData, charID);
        
        
    };
    
    /*
     * Parse out the speed data
     * 
     * @param {type} data - The speed Line minus "Speed"
     * @param {type} charID
     * @returns {undefined}
     */
    var parseSpeed = function(data, charID){
        if(!data){return;}
        var speedVal;
        // Get rid of the units
        data = data.replace(/ft./g,"");
        debugMsg('Cleaned Speed: '+data);
        
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
        var spcTraitNum;
        
         if (!lineStart){
             feedBack('Unable to fine SPECIAL ABILITIES section.');
         }
         log('Starting Special Abilities Block');
         debugMsg('Parse Special Abilities!');
         
         // We'll stick these in racial traits too.  Find the next open one.
         var i = 0;
         do{
             if (getAttribute('repeating_racial-trait_$'+i+'_name', charID)){i++;}
                else{spcTraitNum = i;}
         }while(!spcTraitNum)
    
         
         // Cycle through the section looking for one of the special ability
         // abbreviations (Su, Ex, Sp)
         for(i=lineStart; i<lineEnd; i++){
             spcLoc = data[i].indexOf('(Su)');
             if(spcLoc !== -1){
                spcTraitNum++;
                insertSpecialAbility(data[i], spcLoc, spcTraitNum, charID);                 
             } 
             spcLoc = data[i].indexOf('(Ex)');
             if(spcLoc !== -1){
                spcTraitNum++;
                insertSpecialAbility(data[i], spcLoc, spcTraitNum, charID);                 
             }
             spcLoc = data[i].indexOf('(Sp)');
             if(spcLoc !== -1){
                spcTraitNum++;
                insertSpecialAbility(data[i], spcLoc, spcTraitNum, charID);                 
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
    var insertSpecialAbility = function(data, txtLoc, index, charID){
        setAttribute('repeating_racial-trait_$'+index+'_name',
                        charID,
                        data.substring(0, txtLoc).trim());
        setAttribute('repeating_racial-trait_$'+index+'_short-description',
                        charID,
                        data.substring(0, txtLoc).trim());
        setAttribute('repeating_racial-trait_$'+index+'_description',
                        charID,
                        data.trim());
    };
    
    /*
     * Parse out the core attributes (STR, etc.) and insert them into the sheet
     * 
     * @param {type}  - the array of prime attribute names to look for
     * @param {type} data - the text of the STATISTICS area
     * @param {type} termChars - any delimiters to parse on
     * @param {type} line - the line that the attributes are assumed to be on
     * @param {type} lineStartFnd - the start of the STATISTICS area
     * @param {type} charID - character ID
     * @returns {undefined}
     */
    var parsePrimeAttributes = function(primeAttr, data, termChars, line, lineStartFnd, charID){
        var retval;
        var attrMod;
        while(primeAttr.length > 0) {
                retval = getValueByName(primeAttr[0],data[line],termChars);
                // Remove non-numerical values from the return
                retval = cleanNumber(retval);
                if (!retval) {
                        var nextBestLine = getLineByName(primeAttr[0],data,lineStartFnd);
                        retval = getValueByName(primeAttr[0],data[nextBestLine],termChars);
                        if (!retval) {throw "ERROR: could not find attribute " + primeAttr[0];}
                }
            // The pathfinder character sheet used 'STR-base' (etc.) to store 
            // the base values, so we need to rename the attributes to this
            // format before storing them
            attrMod = primeAttr[0].toUpperCase().trim()+'-base';
            setAttribute(attrMod, charID, retval, retval);
            primeAttr.shift();
        }
    };
    
    /*
     * Parse out the minor attributes (BAB, etc.) and insert them into the sheet
     * 
     * @param {type} minorAttr - the array of prime attribute names to look for
     * @param {type} data - the text of the STATISTICS area
     * @param {type} termChars - any delimiters to parse on
     * @param {type} line - the line that the attributes are assumed to be on
     * @param {type} lineStartFnd - the start of the STATISTICS area
     * @param {type} charID - character ID
     * @returns {undefined}
     */
    var parseMinorAttributes = function(minorAttr, data, termChars, line, lineStartFnd, charID) {
        var retval;
        while(minorAttr.length > 0) {
                retval = getValueByName(minorAttr[0],data[line],termChars);
                // Remove non-numerical values from the return
                retval = cleanNumber(retval);
                if (!retval) {
                        var nextBestLine = getLineByName(minorAttr[0],data,lineStartFnd);
                        retval = getValueByName(minorAttr[0],data[nextBestLine],termChars);
                        if (!retval) {throw "ERROR: could not find attribute " + minorAttr[0];}
                }
            // we have to do funky things with all of these
            switch (minorAttr[0]){
                case 'Base Atk':
                    setAttribute('class-0-bab', charID, retval);
                    break;
                case 'CMB':
                    // We need to look at the calculated CMB and add/sub
                    // from the 'misc' field to make it even
                    /*   - Looks at how to trigger the page to refresh */
                    break;
                case 'CMD':
                    // We need to look at the calculated CMD and add/sub
                    // from the 'misc' field to make it even
                    /*   - Looks at how to trigger the page to refresh */
                    break;
            }
            minorAttr.shift();
        }
    };
    
    /*
     * Parse out the feats and add them in the repeating_feat section
     * of the character sheet
     * 
     * @param {type} data - the raw data
     * @param {type} line - the line the feats are assumed to be on
     * @param {type} charID
     * @returns {undefined}
     */
    var parseFeats = function(data, line, charID) {
        var featName;
        var featData = getValueArray(data[line], ',', 'Feats');
                
        if(featData){
            for(i=0; i<featData.length; i++){ 
                featName = featData[i].trim();
                // Add the info to the character sheet
                setAttribute('repeating_feat_$'+[i]+'_name', charID, featName);
                setAttribute('repeating_feat_$'+[i]+'_short-description', charID, featName);
            }
        }
    };
    
    /*
     * Parse out the languages and insert them into the char sheet
     * 
     * @param {type} dataLine - the line the languages are on
     * @param {type} charID
     * @returns {undefined}
     */
    var parseLanguages = function(dataLine, charID){   
        var langs;
        var langLine = '';
        langLine=dataLine;
        if (!langLine){return;}
        if (langLine.indexOf('Languages') !== -1){
            langs = dataLine.slice(10);
        }

        setAttribute('languages', charID, langs);
    };
    
    /*
     * Parse out any special qualities and add to the char sheet
     * 
     * @param {type} dataLine - the line the SQs are on
     * @param {type} charID
     * @returns {undefined}
     */
    var parseSpecialQualities = function(dataLine, charID){
        if (typeof dataLine === 'undefined'){return;}
        var sqName;
        var sqData = getValueArray(dataLine, ',', 'SQ');
        
        // Until something else is nominated, we'll put these in
        // 'Racial Traits'
        if(sqData){
            //for(i=0; i<sqData.length; i++){ 
            //    sqName = sqData[i].trim();
            //    // Add the info to the character sheet
            //    setAttribute('repeating_racial-trait_$'+[i]+'_name', charID, sqName);
            //    setAttribute('repeating_racial-trait_$'+[i]+'_short-description', charID, sqName);
            //}
            // Finally, put them in the SQ note section
            setAttribute('SQ', charID, sqData);
        }
    };
    
    /**
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
    var getAlignLine = function(data){
        var retval=0;
        var lineEnd = getLineByName('DEFENSE',data);
        retval = getLineByName('N ', data, 0, lineEnd);
        if (!retval) {retval = getLineByName('NG ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('NE ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('LG ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('LE ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('LN ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('CG ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('CE ', data, 0, lineEnd);}
        if (!retval) {retval = getLineByName('CN ', data, 0, lineEnd);}

        return retval;
    };
    
    /*
     * Get the current value (if any) from the character sheet
     * 
     * @param {type} attributeName
     * @param {type} charID
     * @returns {undefined}
     */
    var getAttributeValue = function(attributeName, charID){
        var retval;
        retval = getAttrByName(charID, attributeName);
        return retval;
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
                sendChat("Error on " + attributeName + " attribute", "This attribute has been ignored.");
                return;
            }
            
        // See if the attribute already exists
        if (getAttribute(attributeName, charID)){
                // The attribute already exists, so update it
                var attrUp = getAttribute(attributeName, charID).set(attributeName, normValue);
                log('Updated ' + attributeName + ", " + normValue);
            }else{
                // The attribute doesn't exist, make it
                createObj("attribute", {
                            name: attributeName,
                            current: normValue,
                            characterid: charID
                    });
                
                log('Created ' + attributeName + ", " + normValue);
                return;
            }

    };
    
    /*
     * Send a message to an output stream for debugging.
     * Disable this for production.
     * 
     * @param {string} msg
     * @returns {undefined}
     */
    var debugMsg = function(txt) {
        sendChat("API", txt);
        return;
    };
    
    /*
     * Send the player a feedback message (error, etc).
     * @param {string} txt
     * @returns {undefined}
     */
    var feedBack = function(txt) {
        sendChat("PRDImport", txt);
    };
    
   /*
    * Intercept the chats and see if it is a call to this script or not.
    */
    var handleChatMessage = function(msg) {
		var cmdName = "!PRDImport";
		var msgTxt = msg.content;
		var args;
                if ((msg.type === "api") 
		&& (msgTxt.indexOf(cmdName) !== -1)
		&& playerIsGM(msg.playerid)) {
                    // If it is, do all the magic
                    debugMsg("We detected a call");
                    doImport(msg);
                }
    };
    
    /*
     * Listen for new graphics being added to the desktop.
     * If they're tokens, figure out if they are associated
     * with a character sheet or not.
     * 
     * @param {type} obj
     * @returns Nothing
     */
    var handleAddGraphic = function(obj) {
        var type;
        var charSheet;
        var charId;
        if (!!(type=obj.get('_subtype'))) {
           if (type === 'token') {
               log("Token addition detected");
           }
        }
    };
       
    
    return {
        /**
        * Register Roll20 handlers
        */
       registerAPI : function() {
               on('chat:message',handleChatMessage);
               on('add:graphic',handleAddGraphic);
       },

       init: function() {
              log("PFImport Initializing");
       }
    };
            
    
}());

on("ready", function() {
	'use strict'; 
	PFImport.init();
	PFImport.registerAPI();
});