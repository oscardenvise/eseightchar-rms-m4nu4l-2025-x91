@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
CherrygrovePokecenter1F_MapScripts::
	.byte 0

CherrygrovePokecenter1F_EventScript_CherrygrovePokecenter1FNurseScript::
	setvar VAR_0x800B, 0
	call Common_EventScript_PkmnCenterNurse
	waitmessage
	waitbuttonpress
	release
	end

CherrygrovePokecenter1F_EventScript_CherrygrovePokecenter1FFisherScript::
	msgbox CherrygrovePokecenter1F_Text_CherrygrovePokecenter1FFisherText, MSGBOX_NPC
	end

CherrygrovePokecenter1F_EventScript_CherrygrovePokecenter1FGentlemanScript::
	msgbox CherrygrovePokecenter1F_Text_CherrygrovePokecenter1FGentlemanText, MSGBOX_NPC
	end

CherrygrovePokecenter1F_EventScript_CherrygrovePokecenter1FTeacherScript::
	msgbox CherrygrovePokecenter1F_Text_CherrygrovePokecenter1FTeacherText, MSGBOX_NPC
	end

CherrygrovePokecenter1F_Text_CrystalTodo::
	.string "…$"

CherrygrovePokecenter1F_Text_CherrygrovePokecenter1FFisherText::
	.string "It's great. I can\nstore any number$"

CherrygrovePokecenter1F_Text_CherrygrovePokecenter1FGentlemanText::
	.string "That PC is free\nfor any trainer\lto use.$"

CherrygrovePokecenter1F_Text_CherrygrovePokecenter1FTeacherText::
	.string "The COMMUNICATION\nCENTER upstairs\lwas just built.$"

