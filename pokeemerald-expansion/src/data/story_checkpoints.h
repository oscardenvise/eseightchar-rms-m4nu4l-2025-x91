// Genererat av tools/story/gen_story.py från story/milestones.json – ändra inte för hand.
extern const u8 Story_Checkpoint_johto_start[];
extern const u8 Story_Checkpoint_hoenn_start[];
extern const u8 Story_Checkpoint_hoenn_badge1[];
extern const u8 Story_Checkpoint_hoenn_badge8[];
extern const u8 Story_Checkpoint_hoenn_champion[];

static const struct DebugMenuOption sDebugMenu_Actions_Story[] =
{
    { COMPOUND_STRING("Johto: New Bark Town"), DebugAction_ExecuteScript, Story_Checkpoint_johto_start },
    { COMPOUND_STRING("Hoenn: start"), DebugAction_ExecuteScript, Story_Checkpoint_hoenn_start },
    { COMPOUND_STRING("Hoenn: 1 badge"), DebugAction_ExecuteScript, Story_Checkpoint_hoenn_badge1 },
    { COMPOUND_STRING("Hoenn: 8 badges"), DebugAction_ExecuteScript, Story_Checkpoint_hoenn_badge8 },
    { COMPOUND_STRING("Hoenn: champion"), DebugAction_ExecuteScript, Story_Checkpoint_hoenn_champion },
    { NULL }
};
