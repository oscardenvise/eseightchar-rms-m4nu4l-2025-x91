@ Handskrivet för Kanto-i-Emerald. FireReds ursprungliga labbskript (startval, rivalstrid,
@ Pokédex-story) bygger på specials som inte finns i Emerald. Här delar Oak helt enkelt ut
@ en Kanto-starter till spelaren.
PalletTown_ProfessorOaksLab_MapScripts::
	map_script MAP_SCRIPT_ON_TRANSITION, PalletTown_ProfessorOaksLab_OnTransition
	.byte 0

PalletTown_ProfessorOaksLab_OnTransition::
	clearflag FLAG_HIDE_OAK_IN_HIS_LAB
	setflag FLAG_HIDE_RIVAL_IN_LAB
	setflag FLAG_HIDE_POKEDEX
	end

PalletTown_ProfessorOaksLab_EventScript_ProfOak::
	lock
	faceplayer
	goto_if_set FLAG_KANTO_GOT_STARTER, PalletTown_ProfessorOaksLab_EventScript_OakAfterStarter
	msgbox PalletTown_ProfessorOaksLab_Text_OakWelcome
	release
	end

PalletTown_ProfessorOaksLab_EventScript_OakAfterStarter::
	msgbox PalletTown_ProfessorOaksLab_Text_OakAfterStarter
	release
	end

PalletTown_ProfessorOaksLab_EventScript_BulbasaurBall::
	lock
	goto_if_set FLAG_KANTO_GOT_STARTER, PalletTown_ProfessorOaksLab_EventScript_AlreadyChose
	bufferspeciesname STR_VAR_1, SPECIES_BULBASAUR
	msgbox PalletTown_ProfessorOaksLab_Text_TakeThisMon, MSGBOX_YESNO
	goto_if_eq VAR_RESULT, NO, PalletTown_ProfessorOaksLab_EventScript_DeclineStarter
	givemon SPECIES_BULBASAUR, 5
	goto PalletTown_ProfessorOaksLab_EventScript_ReceivedStarter
	end

PalletTown_ProfessorOaksLab_EventScript_SquirtleBall::
	lock
	goto_if_set FLAG_KANTO_GOT_STARTER, PalletTown_ProfessorOaksLab_EventScript_AlreadyChose
	bufferspeciesname STR_VAR_1, SPECIES_SQUIRTLE
	msgbox PalletTown_ProfessorOaksLab_Text_TakeThisMon, MSGBOX_YESNO
	goto_if_eq VAR_RESULT, NO, PalletTown_ProfessorOaksLab_EventScript_DeclineStarter
	givemon SPECIES_SQUIRTLE, 5
	goto PalletTown_ProfessorOaksLab_EventScript_ReceivedStarter
	end

PalletTown_ProfessorOaksLab_EventScript_CharmanderBall::
	lock
	goto_if_set FLAG_KANTO_GOT_STARTER, PalletTown_ProfessorOaksLab_EventScript_AlreadyChose
	bufferspeciesname STR_VAR_1, SPECIES_CHARMANDER
	msgbox PalletTown_ProfessorOaksLab_Text_TakeThisMon, MSGBOX_YESNO
	goto_if_eq VAR_RESULT, NO, PalletTown_ProfessorOaksLab_EventScript_DeclineStarter
	givemon SPECIES_CHARMANDER, 5
	goto PalletTown_ProfessorOaksLab_EventScript_ReceivedStarter
	end

PalletTown_ProfessorOaksLab_EventScript_ReceivedStarter::
	goto_if_eq VAR_RESULT, MON_CANT_GIVE, PalletTown_ProfessorOaksLab_EventScript_NoRoomForStarter
	setflag FLAG_KANTO_GOT_STARTER
	setflag FLAG_HIDE_BULBASAUR_BALL
	setflag FLAG_HIDE_SQUIRTLE_BALL
	setflag FLAG_HIDE_CHARMANDER_BALL
	removeobject LOCALID_BULBASAUR_BALL
	removeobject LOCALID_SQUIRTLE_BALL
	removeobject LOCALID_CHARMANDER_BALL
	setvar VAR_MAP_SCENE_PALLET_TOWN_RIVALS_HOUSE, 1
	playfanfare MUS_OBTAIN_ITEM
	message PalletTown_ProfessorOaksLab_Text_ReceivedMon
	waitmessage
	waitfanfare
	copyvar VAR_0x8005, VAR_RESULT
	msgbox gText_NicknameThisPokemon, MSGBOX_YESNO
	goto_if_eq VAR_RESULT, NO, PalletTown_ProfessorOaksLab_EventScript_StarterDone
	goto_if_eq VAR_0x8005, MON_GIVEN_TO_PC, PalletTown_ProfessorOaksLab_EventScript_NicknameBoxStarter
	call Common_EventScript_GetGiftMonPartySlot
	call Common_EventScript_NameReceivedPartyMon
	goto PalletTown_ProfessorOaksLab_EventScript_StarterDone
	end

PalletTown_ProfessorOaksLab_EventScript_NicknameBoxStarter::
	call Common_EventScript_NameReceivedBoxMon
	goto PalletTown_ProfessorOaksLab_EventScript_StarterDone
	end

PalletTown_ProfessorOaksLab_EventScript_StarterDone::
	msgbox PalletTown_ProfessorOaksLab_Text_OakTakeGoodCare
	release
	end

PalletTown_ProfessorOaksLab_EventScript_NoRoomForStarter::
	msgbox PalletTown_ProfessorOaksLab_Text_NoRoomForMon
	release
	end

PalletTown_ProfessorOaksLab_EventScript_DeclineStarter::
	msgbox PalletTown_ProfessorOaksLab_Text_ThinkItOver
	release
	end

PalletTown_ProfessorOaksLab_EventScript_AlreadyChose::
	msgbox PalletTown_ProfessorOaksLab_Text_AlreadyChose
	release
	end

PalletTown_ProfessorOaksLab_EventScript_Rival::
	msgbox PalletTown_ProfessorOaksLab_Text_RivalBusy, MSGBOX_NPC
	end

PalletTown_ProfessorOaksLab_EventScript_Pokedex::
	msgbox PalletTown_ProfessorOaksLab_Text_ItsPokedex, MSGBOX_SIGN
	end

PalletTown_ProfessorOaksLab_EventScript_Aide1::
	msgbox PalletTown_ProfessorOaksLab_Text_Aide1, MSGBOX_NPC
	end

PalletTown_ProfessorOaksLab_EventScript_Aide2::
	msgbox PalletTown_ProfessorOaksLab_Text_Aide2, MSGBOX_NPC
	end

PalletTown_ProfessorOaksLab_EventScript_Aide3::
	msgbox PalletTown_ProfessorOaksLab_Text_Aide3, MSGBOX_NPC
	end

PalletTown_ProfessorOaksLab_EventScript_Computer::
	msgbox PalletTown_ProfessorOaksLab_Text_Computer, MSGBOX_SIGN
	end

PalletTown_ProfessorOaksLab_EventScript_LeftSign::
	msgbox PalletTown_ProfessorOaksLab_Text_LeftSign, MSGBOX_SIGN
	end

PalletTown_ProfessorOaksLab_EventScript_RightSign::
	msgbox PalletTown_ProfessorOaksLab_Text_RightSign, MSGBOX_SIGN
	end

PalletTown_ProfessorOaksLab_Text_OakWelcome::
	.string "OAK: Ah, a TRAINER all the way from\n"
	.string "the HOENN region! Welcome to KANTO.\p"
	.string "Those three POKé BALLS hold POKéMON\n"
	.string "native to KANTO.\p"
	.string "Go on, pick the one you like!$"

PalletTown_ProfessorOaksLab_Text_OakAfterStarter::
	.string "OAK: How is your new POKéMON doing?\p"
	.string "KANTO has many POKéMON you won't\n"
	.string "find in HOENN. Go and see them all!$"

PalletTown_ProfessorOaksLab_Text_TakeThisMon::
	.string "So! You want the {STR_VAR_1}?$"

PalletTown_ProfessorOaksLab_Text_ReceivedMon::
	.string "{PLAYER} received {STR_VAR_1}\n"
	.string "from PROF. OAK!$"

PalletTown_ProfessorOaksLab_Text_OakTakeGoodCare::
	.string "OAK: Take good care of it!$"

PalletTown_ProfessorOaksLab_Text_NoRoomForMon::
	.string "OAK: Your party and your PC BOXES\n"
	.string "are full. Make room first!$"

PalletTown_ProfessorOaksLab_Text_ThinkItOver::
	.string "OAK: Take your time and think\n"
	.string "it over.$"

PalletTown_ProfessorOaksLab_Text_AlreadyChose::
	.string "OAK: You already have your KANTO\n"
	.string "POKéMON. This one is for someone\l"
	.string "else.$"

PalletTown_ProfessorOaksLab_Text_RivalBusy::
	.string "{RIVAL}: Gramps is busy with some\n"
	.string "TRAINER from another region…$"

PalletTown_ProfessorOaksLab_Text_ItsPokedex::
	.string "It's a POKéDEX.$"

PalletTown_ProfessorOaksLab_Text_Aide1::
	.string "PROF. OAK is the authority on\n"
	.string "POKéMON here in KANTO.$"

PalletTown_ProfessorOaksLab_Text_Aide2::
	.string "I hear the POKéMON in HOENN are\n"
	.string "quite different from ours.$"

PalletTown_ProfessorOaksLab_Text_Aide3::
	.string "I'm one of PROF. OAK's aides.\p"
	.string "We study POKéMON in the wild.$"

PalletTown_ProfessorOaksLab_Text_Computer::
	.string "There's an e-mail from PROF. BIRCH\n"
	.string "of the HOENN region on the screen.$"

PalletTown_ProfessorOaksLab_Text_LeftSign::
	.string "Press START to open the MENU.$"

PalletTown_ProfessorOaksLab_Text_RightSign::
	.string "The SAVE option is found on the\n"
	.string "MENU.$"

@ FireReds triggerrutor för startvals-scenen finns kvar i map.json men gör inget här.
PalletTown_ProfessorOaksLab_EventScript_LeaveStarterSceneTrigger::
	end

PalletTown_ProfessorOaksLab_EventScript_RivalBattleTriggerLeft::
	end

PalletTown_ProfessorOaksLab_EventScript_RivalBattleTriggerMid::
	end

PalletTown_ProfessorOaksLab_EventScript_RivalBattleTriggerRight::
	end
