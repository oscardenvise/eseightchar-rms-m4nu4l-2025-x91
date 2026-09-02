@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
PlayersNeighborsHouse_MapScripts::
	.byte 0

PlayersNeighborsHouse_EventScript_PlayersNeighborsDaughterScript::
	msgbox PlayersNeighborsHouse_Text_PlayersNeighborsDaughterText, MSGBOX_NPC
	end

PlayersNeighborsHouse_EventScript_PlayersNeighborScript::
	msgbox PlayersNeighborsHouse_Text_PlayersNeighborText, MSGBOX_NPC
	end

PlayersNeighborsHouse_EventScript_PlayersNeighborsHouseBookshelfScript::
	msgbox PlayersNeighborsHouse_Text_CrystalTodo, MSGBOX_SIGN
	end

PlayersNeighborsHouse_EventScript_PlayersNeighborsHouseRadioScript::
	msgbox PlayersNeighborsHouse_Text_PlayerNeighborRadioText1, MSGBOX_SIGN
	end

PlayersNeighborsHouse_Text_CrystalTodo::
	.string "…$"

PlayersNeighborsHouse_Text_PlayerNeighborRadioText1::
	.string "PROF.OAK'S POKéMON\nTALK! Please tune\lin next time!$"

PlayersNeighborsHouse_Text_PlayersNeighborText::
	.string "My daughter is\nadamant about$"

PlayersNeighborsHouse_Text_PlayersNeighborsDaughterText::
	.string "PIKACHU is an\nevolved POKéMON.$"

