import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadLocalEnv } from '../src/server/services/envLoader.js';

loadLocalEnv(process.cwd());

const ARK_API_KEY = process.env.ARK_API_KEY;
if (!ARK_API_KEY) {
  console.error('Missing ARK_API_KEY in .env.local');
  process.exit(1);
}

const ROLES_DIR = path.resolve(process.cwd(), 'public/images/roles');
const AVATARS_DIR = path.resolve(process.cwd(), 'public/images/avatars');
const TMP_DIR = path.resolve(process.cwd(), '.cache/raw_flagship_art');
const FFMPEG_BIN = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const CWEBP_BIN = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';
fs.mkdirSync(ROLES_DIR, { recursive: true });
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

interface ArtJob {
  outPath: string;
  size: '960x1280' | '1024x1024';
  cropFilter: string;
  prompt: string;
}

const TAROT_STYLE =
  'Luxury dark velvet & gold-foil board game tarot card portrait illustration, dramatic chiaroscuro rim lighting, ornate filigree frame accents, rich painterly fantasy art, pitch dark background, NO text, NO letters, NO numbers, NO watermarks.';

const AVATAR_STYLE =
  'Upscale anthropomorphic masquerade salon portrait bust, dark obsidian and gold velvet backdrop, warm rim light, luxury tabletop game character icon, crisp centered portrait, NO text, NO letters, NO numbers.';

const ROLE_JOBS: Array<{ id: string; desc: string }> = [
  { id: 'merlin', desc: 'Wise bearded archmage in midnight-blue velvet robes adorned with golden stars, holding a glowing crystal-tipped staff' },
  { id: 'percival', desc: 'Noble silver-armored paladin knight with radiant royal blue mantle and gleaming crest shield' },
  { id: 'loyal', desc: 'Valiant Arthurian round-table knight in polished steel and royal blue-gold cape holding a ceremonial sword upright' },
  { id: 'morgana', desc: 'Enchanting dark sorceress in violet and gold velvet gown holding an ornate silver illusion mirror with swirling twilight mist' },
  { id: 'assassin', desc: 'Hooded shadow assassin in obsidian leather and gold trim holding a gleaming curved obsidian dagger, emerald eyes' },
  { id: 'mordred', desc: 'Imposing dark dread lord in horned obsidian and crimson-gold plate armor radiating menacing authority' },
  { id: 'oberon', desc: 'Eerie masked fey shadow phantom emerging from silver moonlit forest mist with glowing violet eyes and thorny crown' },
  { id: 'minion', desc: 'Sinister dark cultist knight in blackened steel helm with glowing crimson crest and shadow cloak' },
  { id: 'werewolf', desc: 'Ferocious aristocratic gothic werewolf in tattered crimson velvet coat under a blood-red lunar eclipse, glowing amber eyes' },
  { id: 'villager', desc: 'Determined Victorian manor townsfolk holding a warm glowing brass lantern against dark castle shadows' },
  { id: 'seer', desc: 'Mystic gothic fortune-teller in starry indigo cloak gazing into a levitating luminous moonlit crystal orb' },
  { id: 'witch', desc: 'Enigmatic gothic alchemist in plum velvet holding a glowing emerald elixir vial in one hand and a shadowy violet poison flask in the other' },
  { id: 'hunter', desc: 'Rugged silver-bullet monster hunter in weathered leather trenchcoat holding an ornate silver-engraved flintlock rifle' },
  { id: 'guard', desc: 'Stalwart armored temple guardian holding a massive golden lion-crested tower shield in front of iron manor gates' },
];

const AVATAR_JOBS: Array<{ id: string; desc: string }> = [
  { id: 'crown', desc: 'Regal aristocratic lion-hearted gentleman wearing a burnished golden crown and emerald velvet smoking jacket' },
  { id: 'fox', desc: 'Dapper sly red fox gentleman wearing a black velvet tuxedo, gold monocle, and silk bow tie' },
  { id: 'wolf', desc: 'Distinguished silver-furred nobleman wolf wearing a high-collared crimson and gold gothic coat' },
  { id: 'owl', desc: 'Wise midnight barn owl scholar wearing brass spectacles, velvet waistcoat, and tiny golden pocket watch' },
  { id: 'cat', desc: 'Glamorous sleek black velvet cat diva wearing a pearl necklace and golden masquerade tiara' },
  { id: 'dragon', desc: 'Majestic emerald-and-gold eastern dragon aristocrat in embroidered imperial silk brocade' },
  { id: 'mask', desc: 'Mysterious Venetian phantom opera figure wearing a half-face ornate gold filigree masquerade mask and plum cape' },
  { id: 'unicorn', desc: 'Iridescent celestial white unicorn portrait with golden spiral horn and shimmering sapphire mane' },
  { id: 'lion', desc: 'Proud golden-maned lion knight wearing polished gold-trimmed royal paladin shoulder plates' },
  { id: 'swan', desc: 'Graceful ivory swan duchess wearing a sparkling diamond choker and silver feather collar' },
  { id: 'octopus', desc: 'Clever steampunk kraken baron wearing a tiny brass-goggled top hat and velvet waistcoat' },
  { id: 'panda', desc: 'Jovial giant panda tycoon wearing a burgundy silk vest, round golden glasses, and holding gold coins' },
];

const ALL_JOBS: ArtJob[] = [
  ...ROLE_JOBS.map((r) => ({
    outPath: path.join(ROLES_DIR, `${r.id}.webp`),
    size: '960x1280' as const,
    cropFilter: 'scale=480:640:force_original_aspect_ratio=increase,crop=480:640',
    prompt: `${r.desc}. ${TAROT_STYLE}`,
  })),
  ...AVATAR_JOBS.map((a) => ({
    outPath: path.join(AVATARS_DIR, `${a.id}.webp`),
    size: '1024x1024' as const,
    cropFilter: 'scale=256:256:force_original_aspect_ratio=increase,crop=256:256',
    prompt: `${a.desc}. ${AVATAR_STYLE}`,
  })),
];

async function generateOne(job: ArtJob): Promise<void> {
  if (fs.existsSync(job.outPath) && fs.statSync(job.outPath).size > 4000) {
    console.log(`[skip] ${path.basename(job.outPath)}`);
    return;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ARK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'doubao-seedream-5-5-261028',
          prompt: job.prompt,
          size: job.size,
          watermark: false,
          response_format: 'url',
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = (await res.json()) as { data?: Array<{ url?: string }> };
      const url = data.data?.[0]?.url;
      if (!url) throw new Error('Missing image URL in Seedream response');

      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`Image fetch HTTP ${imgRes.status}`);
      const base = path.basename(job.outPath, '.webp');
      const rawFile = path.join(TMP_DIR, `${base}.jpg`);
      const pngFile = path.join(TMP_DIR, `${base}.png`);
      fs.writeFileSync(rawFile, Buffer.from(await imgRes.arrayBuffer()));

      execFileSync(FFMPEG_BIN, [
        '-y',
        '-i',
        rawFile,
        '-vf',
        job.cropFilter,
        pngFile,
        '-loglevel',
        'error',
      ]);
      execFileSync(CWEBP_BIN, ['-quiet', '-q', '84', pngFile, '-o', job.outPath]);
      fs.unlinkSync(rawFile);
      fs.unlinkSync(pngFile);

      console.log(`[done] ${path.relative(process.cwd(), job.outPath)} (${fs.statSync(job.outPath).size} bytes)`);
      return;
    } catch (err) {
      if (attempt === 0) {
        console.warn(`[retry] ${path.basename(job.outPath)}:`, err);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  for (let i = 0; i < ALL_JOBS.length; i += 4) {
    await Promise.all(ALL_JOBS.slice(i, i + 4).map((j) => generateOne(j)));
  }
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('All 26 Seedream 5.5 flagship art assets complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
