@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
PlayersHouse1F_MapScripts::
	.byte 0

PlayersHouse1F_EventScript_MomScript::
	msgbox PlayersHouse1F_Text_HurryUpElmIsWaitingText, MSGBOX_NPC
	end

PlayersHouse1F_EventScript_NeighborScript::
	msgbox PlayersHouse1F_Text_CrystalTodo, MSGBOX_NPC
	end

PlayersHouse1F_EventScript_MeetMomLeftScript::
	lockall
	setvar VAR_SCENE_PLAYERS_HOUSE_1F, 1
	releaseall
	end

PlayersHouse1F_EventScript_MeetMomRightScript::
	lockall
	setvar VAR_SCENE_PLAYERS_HOUSE_1F, 1
	releaseall
	end

PlayersHouse1F_EventScript_PlayersHouse1FStoveScript::
	msgbox PlayersHouse1F_Text_PlayersHouse1FStoveText, MSGBOX_SIGN
	end

PlayersHouse1F_EventScript_PlayersHouse1FSinkScript::
	msgbox PlayersHouse1F_Text_PlayersHouse1FSinkText, MSGBOX_SIGN
	end

PlayersHouse1F_EventScript_PlayersHouse1FFridgeScript::
	msgbox PlayersHouse1F_Text_PlayersHouse1FFridgeText, MSGBOX_SIGN
	end

PlayersHouse1F_EventScript_PlayersHouse1FTVScript::
	msgbox PlayersHouse1F_Text_PlayersHouse1FTVText, MSGBOX_SIGN
	end

PlayersHouse1F_Text_CrystalTodo::
	.string "…$"

PlayersHouse1F_Text_HurryUpElmIsWaitingText::
	.string "PROF.ELM is wait-\ning for you.$"

PlayersHouse1F_Text_PlayersHouse1FFridgeText::
	.string "Let's see what's\nin the fridge…$"

PlayersHouse1F_Text_PlayersHouse1FSinkText::
	.string "The sink is spot-\nless. Mom likes it\lclean.$"

PlayersHouse1F_Text_PlayersHouse1FStoveText::
	.string "Mom's specialty!$"

PlayersHouse1F_Text_PlayersHouse1FTVText::
	.string "There's a movie on\nTV: Stars dot the$"

