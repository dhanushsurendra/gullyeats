const { test } = require('node:test')
const assert = require('node:assert')
const { check } = require('../utils/wordFilter')

function expectAll(verdict, texts) {
  const wrong = texts
    .map((t) => [t, check(t)])
    .filter(([, r]) => r.verdict !== verdict)
    .map(([t, r]) => `${JSON.stringify(t)} → ${r.verdict} ${r.reason}`)
  assert.deepStrictEqual(wrong, [], `expected ${verdict}`)
}

test('exact prohibited words are blocked', () => {
  expectAll('BLOCK', [
    'what the fuck',
    'you are a bitch',
    'total asshole this guy',
    'such a slut',
    'chutiya hai woh',
    'madarchod',
    'saala bhosdike',
    'randi',
    'nigger',
    'kill yourself',
    'kys loser',
  ])
})

test('disguised spellings are blocked', () => {
  expectAll('BLOCK', [
    'FUCK',
    'fuuuuuck this',
    'f u c k',
    'f.u.c.k',
    'f-u-c-k you',
    'fu ck',
    'fvck'.replace('v', 'u'),
    'b1tch',
    'sh1t head b!tch',
    '@sshole',
    'phuck off',
    'fuk off',
    'fuckers everywhere',
    'motherfuckers',
    'fckkk',
    'B I T C H',
    'ｆｕｃｋ', // full-width letters
    'fúck',
    'f​u​c​k', // zero-width spaces
  ])
})

test('Indian-language abuse is blocked, transliterated and in script', () => {
  expectAll('BLOCK', [
    // Hindi
    'chootiya', 'chutia', 'maderchod', 'behenchod', 'bhenchod', 'bahenchod', 'bhosdi ke', 'lauda', 'lawda', 'gaand', 'jhaatu',
    'मादरचोद', 'चूतिया', 'भोसड़ी के', 'रंडी', 'गाँड',
    // Kannada
    'sule maga', 'sulemaga', 'bolimaga', 'bolimagane', 'nin amman', 'tunne', 'bevarsi',
    'ಸೂಳೆಮಗ', 'ಬೋಳಿಮಗನೆ', 'ತುಣ್ಣೆ',
    // Tamil
    'thevidiya', 'thevdiya paiya', 'thayoli', 'pundai', 'koothi', 'otha',
    'தேவடியா', 'புண்டை', 'தாயோளி',
    // Telugu
    'lanja', 'lanjakoduku', 'dengu', 'modda',
    'లంజ', 'లంజకొడుకు', 'దెంగు',
    // Malayalam
    'poorimone', 'myre', 'kunna', 'thayoli', 'pulayadi mone', 'kazhuveri',
    'പൂറിമോൻ', 'മൈര്', 'കുണ്ണ',
  ])
})

test('close misspellings, masks, mild words and targeted ambiguous words go to review', () => {
  expectAll('REVIEW', [
    'f**k this',
    'b***h',
    'madarchud',
    'holy shit the chaat was spicy',
    's h i t',
    'bulshit',
    'what a bastard',
    'harami dukaandar',
    'kamine log',
    'i will kill you',
    'go die',
    'send nudes',
    'i had sex in the car',
    'we made out behind the chaat stall',
    'sex education is important', // any mention of sex gets a human look
    'i was raped last year', // a survivor's story must reach a person, not be auto-blocked
    'jihadi',
    'saala tu', // ambiguous next to "tu"
    'nee naayi', // Kannada "you dog"
    'you pig',
    'u r a dick',
    'what an ass you are',
  ])
})

test('a severe stem inside a longer word is blocked', () => {
  expectAll('BLOCK', ['chutiyapanti hai yeh', 'fuckface', 'bhosdiwale'])
})

test('innocent text is allowed (false positives)', () => {
  expectAll('ALLOW', [
    'The pani puri here is the best in Bangalore',
    'I ordered masala dosa with coconut chutney',
    'chutney was amazing, extra chutneys please',
    'Assam tea with cumin biscuits',
    'kitchen-cum-dining area was clean',
    'Scunthorpe has nice cocktail bars',
    'the assassin in the movie was a classic',
    'Peacock feathers and a cockroach, ew',
    'I love duck curry and good luck charms',
    'hot dog stall near the bus stop',
    'This batch of samosas was perfect, pitch perfect',
    'grape juice and rapeseed oil',
    'Dickens novels while waiting for my order',
    'my therapist said eat more vegetables',
    'Sussex and Essex are in England',
    'He gave me a title of best customer',
    'the panda ate bamboo',
    'shuttlecock and badminton after dinner',
    'sugandh of the biryani',
    'Mahatma Gandhi road stall',
    'grandma makes the best laddoo',
    'this tune is stuck in my head',
    'I watched a random movie',
    'my brother and mother love bhel puri',
    'chod do yaar, kal milte hai', // "leave it, man" in Hindi
    'kutta was sleeping near the cart', // "dog", nobody targeted
    'Dick Grayson is my favourite hero',
    'we went to the pool after eating poori',
    'kambi pole near the shop',
    'pass the salt please',
    'that was a lucky shot at the fair',
    'the dengue season is here, stay safe',
    'Chamarajpet has great food',
    'Malayalam movie was superb, ninte chaya kollam',
    'I died laughing at this',
    'my gandu friend is funny', // Kannada "gandu" = man
    'cute couple at the next table',
    'cutie pie served me tea',
    'BC era history class',
    'MC at the wedding was hilarious',
    'Fuchsia coloured lassi?',
    'Randy from the US loved the vada pav',
    'ಊಟ ತುಂಬಾ ಚೆನ್ನಾಗಿತ್ತು',
    'சாப்பாடு ரொம்ப நல்லா இருந்துச்சு',
    'భోజనం చాలా బాగుంది',
    'ഭക്ഷണം വളരെ നന്നായിരുന്നു',
    'खाना बहुत अच्छा था',
    '2 plates for ₹40!!! 10/10',
    'covid19 changed my life',
    'I confess I ate 4 samosas at 1am',
    'This is the bestttt chaat everrrr!!!',
    'loads of love to the vendor',
    'the shiitake mushroom was a shift from normal',
    'bhangra night after biryani',
    'cocktails and cucumbers',
    'documents for the circumstances',
    'that pundit was so wise',
    'my boss is a total moron lol',
  ])
})

test('result lists matched words with category for the admin view', () => {
  const r = check('you are a b1tch')
  assert.strictEqual(r.verdict, 'BLOCK')
  assert.strictEqual(r.matches[0].term, 'bitch')
  assert.strictEqual(r.matches[0].found, 'b1tch')
  assert.strictEqual(r.matches[0].category, 'abuse')
  assert.match(r.reason, /abuse/)
})
