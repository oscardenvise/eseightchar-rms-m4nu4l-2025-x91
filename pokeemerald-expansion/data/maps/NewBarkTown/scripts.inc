@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
NewBarkTown_MapScripts::
	.byte 0

NewBarkTown_EventScript_NewBarkTownTeacherScript::
	msgbox NewBarkTown_Text_Text_GearIsImpressive, MSGBOX_NPC
	end

NewBarkTown_EventScript_NewBarkTownFisherScript::
	msgbox NewBarkTown_Text_Text_ElmDiscoveredNewMon, MSGBOX_NPC
	end

NewBarkTown_EventScript_NewBarkTownRivalScript::
	msgbox NewBarkTown_Text_NewBarkTownRivalText1, MSGBOX_NPC
	end

NewBarkTown_EventScript_NewBarkTown_TeacherStopsYouScene1::
	lockall
	msgbox NewBarkTown_Text_Text_WaitPlayer
	setvar VAR_SCENE_NEW_BARK_TOWN, 1
	releaseall
	end

NewBarkTown_EventScript_NewBarkTown_TeacherStopsYouScene2::
	lockall
	msgbox NewBarkTown_Text_Text_WaitPlayer
	setvar VAR_SCENE_NEW_BARK_TOWN, 1
	releaseall
	end

NewBarkTown_EventScript_NewBarkTownSign::
	msgbox NewBarkTown_Text_NewBarkTownSignText, MSGBOX_SIGN
	end

NewBarkTown_EventScript_NewBarkTownPlayersHouseSign::
	msgbox NewBarkTown_Text_NewBarkTownPlayersHouseSignText, MSGBOX_SIGN
	end

NewBarkTown_EventScript_NewBarkTownElmsLabSign::
	msgbox NewBarkTown_Text_NewBarkTownElmsLabSignText, MSGBOX_SIGN
	end

NewBarkTown_EventScript_NewBarkTownElmsHouseSign::
	msgbox NewBarkTown_Text_NewBarkTownElmsHouseSignText, MSGBOX_SIGN
	end

NewBarkTown_Text_CrystalTodo::
	.string "…$"

NewBarkTown_Text_NewBarkTownElmsHouseSignText::
	.string "ELM'S HOUSE$"

NewBarkTown_Text_NewBarkTownElmsLabSignText::
	.string "ELM POKéMON LAB$"

NewBarkTown_Text_NewBarkTownPlayersHouseSignText::
	.string "{PLAYER}'s House$"

NewBarkTown_Text_NewBarkTownRivalText1::
	.string "…$"

NewBarkTown_Text_NewBarkTownSignText::
	.string "NEW BARK TOWN$"

NewBarkTown_Text_Text_ElmDiscoveredNewMon::
	.string "Yo, {PLAYER}!$"

NewBarkTown_Text_Text_GearIsImpressive::
	.string "Wow, your POKéGEAR\nis impressive!$"

NewBarkTown_Text_Text_WaitPlayer::
	.string "Wait, {PLAYER}!$"

