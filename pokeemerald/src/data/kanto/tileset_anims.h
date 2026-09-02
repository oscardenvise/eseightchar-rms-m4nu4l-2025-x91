// Genererad av tools/kanto_import – FireReds General-animationer (blommor, vatten, sandkant)
static const u16 sTilesetAnims_KantoGeneral_Flower_Frame0[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/flower/0.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Flower_Frame1[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/flower/1.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Flower_Frame2[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/flower/2.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Flower_Frame3[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/flower/3.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Flower_Frame4[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/flower/4.4bpp");
static const u16 *const sTilesetAnims_KantoGeneral_Flower[] = {
    sTilesetAnims_KantoGeneral_Flower_Frame0,
    sTilesetAnims_KantoGeneral_Flower_Frame1,
    sTilesetAnims_KantoGeneral_Flower_Frame2,
    sTilesetAnims_KantoGeneral_Flower_Frame3,
    sTilesetAnims_KantoGeneral_Flower_Frame4,
};

static const u16 sTilesetAnims_KantoGeneral_Water_Frame0[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/0.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame1[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/1.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame2[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/2.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame3[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/3.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame4[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/4.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame5[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/5.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame6[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/6.4bpp");
static const u16 sTilesetAnims_KantoGeneral_Water_Frame7[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/water_current_landwatersedge/7.4bpp");
static const u16 *const sTilesetAnims_KantoGeneral_Water[] = {
    sTilesetAnims_KantoGeneral_Water_Frame0,
    sTilesetAnims_KantoGeneral_Water_Frame1,
    sTilesetAnims_KantoGeneral_Water_Frame2,
    sTilesetAnims_KantoGeneral_Water_Frame3,
    sTilesetAnims_KantoGeneral_Water_Frame4,
    sTilesetAnims_KantoGeneral_Water_Frame5,
    sTilesetAnims_KantoGeneral_Water_Frame6,
    sTilesetAnims_KantoGeneral_Water_Frame7,
};

static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame0[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/0.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame1[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/1.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame2[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/2.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame3[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/3.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame4[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/4.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame5[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/5.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame6[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/6.4bpp");
static const u16 sTilesetAnims_KantoGeneral_SandWatersEdge_Frame7[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/sandwatersedge/7.4bpp");
static const u16 *const sTilesetAnims_KantoGeneral_SandWatersEdge[] = {
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame0,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame1,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame2,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame3,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame4,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame5,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame6,
    sTilesetAnims_KantoGeneral_SandWatersEdge_Frame7,
};

static void QueueAnimTiles_KantoGeneral_Flower(u16 timer)
{
    AppendTilesetAnimToBuffer(sTilesetAnims_KantoGeneral_Flower[timer % ARRAY_COUNT(sTilesetAnims_KantoGeneral_Flower)], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(508)), 4 * TILE_SIZE_4BPP);
}

static void QueueAnimTiles_KantoGeneral_Water(u16 timer)
{
    AppendTilesetAnimToBuffer(sTilesetAnims_KantoGeneral_Water[timer % ARRAY_COUNT(sTilesetAnims_KantoGeneral_Water)], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(416)), 48 * TILE_SIZE_4BPP);
}

static void QueueAnimTiles_KantoGeneral_SandWatersEdge(u16 timer)
{
    AppendTilesetAnimToBuffer(sTilesetAnims_KantoGeneral_SandWatersEdge[timer % ARRAY_COUNT(sTilesetAnims_KantoGeneral_SandWatersEdge)], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(464)), 18 * TILE_SIZE_4BPP);
}

static void TilesetAnim_KantoGeneral(u16 timer)
{
    if (timer % 8 == 0)
        QueueAnimTiles_KantoGeneral_SandWatersEdge(timer / 8);
    if (timer % 16 == 1)
        QueueAnimTiles_KantoGeneral_Water(timer / 16);
    if (timer % 16 == 2)
        QueueAnimTiles_KantoGeneral_Flower(timer / 16);
}

void InitTilesetAnim_KantoGeneral(void)
{
    sPrimaryTilesetAnimCounter = 0;
    sPrimaryTilesetAnimCounterMax = 640;
    sPrimaryTilesetAnimCallback = TilesetAnim_KantoGeneral;
}
