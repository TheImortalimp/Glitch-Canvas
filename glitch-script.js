document.addEventListener('DOMContentLoaded', () => {

    class GlitchController {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) {
                console.error(`Canvas element with id "${canvasId}" not found.`);
                return;
            }
            this.gctx = this.canvas.getContext('2d');

            // Core state
            this.lastFrameTime = performance.now();
            this.customTime = 0;
            this.masterBeat = 0;
            this.isLooping = false;

            // Controllable parameters
            this.timeScale = 1.0;
            this.masterOpacity = 0.5; // Default from glitch-test.html
            this.effectAlphas = {};

            this.activeEffects = [];
            
            this.defineEffects();
            this.init();
        }

        defineEffects() {
            // Defines all available effects, their factories, and default alpha values.
            this.effectDefinitions = [
                { name: 'Neon Grad', factory: this.factories.neonGradient, defaultAlpha: 0.0 },
                { name: 'Scanlines', factory: this.factories.scanlines, defaultAlpha: 0.0 },
                { name: 'Data Bands', factory: this.factories.vhs, defaultAlpha: 0.0 },
                { name: 'Flash', factory: this.factories.brightFlash, defaultAlpha: 0.0 },
                { name: 'HSL Rainbow', factory: this.factories.hslRainbow, defaultAlpha: 0.0 },
                { name: 'ASCII', factory: this.factories.asciiArt, defaultAlpha: 0.0 },
                { name: 'Font Burn', factory: this.factories.fontBurn, defaultAlpha: 0.0 },
                { name: 'Strobe', factory: this.factories.strobe, defaultAlpha: 0.0 },
                { name: 'Gemini Bomb', factory: this.factories.geminiBomb, defaultAlpha: 0.0 },
                // Master effects (handled in applyMasterFilters, no factory)
                { name: 'B&W Invert', defaultAlpha: 0.0 },
                { name: 'Hue/Color Cycle', defaultAlpha: 0.0 },
                { name: 'Data Bomb', defaultAlpha: 0.0 },
                { name: 'VHS Glitch', factory: this.factories.vhsGlitch, defaultAlpha: 0.0}
            ];
        }

        init() {
            this.resize();
            window.addEventListener('resize', () => this.resize());

            this.setupGlobalHooks();

            // Initialize alphas to their defaults
            this.effectDefinitions.forEach(def => {
                this.effectAlphas[def.name] = def.defaultAlpha;
            });
            
            // Build the active effects list from factories
            this.effectDefinitions.forEach(def => {
                if (def.factory) {
                    const getStrength = () => (this.effectAlphas[def.name] || 0) * this.masterOpacity;
                    this.activeEffects.push(def.factory(getStrength));
                }
            });

            if (!this.isLooping) {
                this.mainRenderLoop();
            }
        }
        
        setupGlobalHooks() {
            // Allows glitch-test.html's slider to control master opacity
            window.__setGlitchMasterOpacity = (value) => {
                this.masterOpacity = parseFloat(value);
            };

            // Allows glitch-test.html's buttons to toggle effects on and off
            window.__toggleEffect = (effectName, isActive) => {
                if (typeof this.effectAlphas[effectName] !== 'undefined') {
                    this.effectAlphas[effectName] = isActive ? 1.0 : 0.0;
                }
            };
            
            // This is kept for compatibility with the HTML, but is a no-op
            window.initializeGlitchCanvases = () => {};
        }

        resize() {
            const dpr = window.devicePixelRatio || 1;
            const width = this.canvas.offsetWidth;
            const height = this.canvas.offsetHeight;
            if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
                 this.canvas.width = width * dpr;
                 this.canvas.height = height * dpr;
            }
        }

        applyMasterFilters() {
            const container = document.getElementById('glitch-container');
            if (!container) return;
    
            const filters = [];
            const bwStrength = (this.effectAlphas['B&W Invert'] ?? 0) * this.masterOpacity;
            if (bwStrength > 0.01) {
                let grayscale = Math.min(1, bwStrength * 2);
                let invertValue = (bwStrength > 0.5) ? (bwStrength - 0.5) * 2 : 0;
                filters.push(`grayscale(${grayscale}) invert(${invertValue})`);
            }
    
            const hueStrength = (this.effectAlphas['Hue/Color Cycle'] ?? 0) * this.masterOpacity;
            if (hueStrength > 0.01) {
                const angle = hueStrength * 360;
                filters.push(`hue-rotate(${angle}deg)`);
            }
    
            container.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
        }
        
        mainRenderLoop() {
            this.isLooping = true;
            const now = performance.now();
            const deltaTime = now - this.lastFrameTime;
            this.lastFrameTime = now;

            this.timeScale = window.__glitchSpeed !== undefined ? window.__glitchSpeed : 1.0;
            const dataBombStrength = (this.effectAlphas['Data Bomb'] || 0) * this.masterOpacity;
            const effectiveTimeScale = this.timeScale * (1.0 - dataBombStrength * 0.9);
            this.customTime += deltaTime * effectiveTimeScale;
            this.masterBeat = (Math.sin(this.customTime / 200) + 1) / 2;

            const dpr = window.devicePixelRatio || 1;
            this.gctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.gctx.save();
            this.gctx.scale(dpr,dpr);

            this.activeEffects.forEach(fn => fn(this.gctx));
            
            this.gctx.restore();

            this.applyMasterFilters();

            requestAnimationFrame(() => this.mainRenderLoop());
        }

        factories = {
            asciiArt: (getStrength) => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{};:,./?~АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンاإءآؤئابةتثجحخدذرزسشصضطظعغفقكلمنهويאבגדהוזחטיכךלמםנןסעפףצץקרשתأبتثجحخدذرزسشصضطظعغفقكلمنهءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهويويअआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहกขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分的一是在不了有和人這中大為上個國我以要他時來用們生到作地於出就分░▒▓█─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬!#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´≡±‗¾¶§÷¸°¨·¹³²■ñÑ@¿?¡:!/áéíóúÁÉÍÓÚäëïöüÄËÏÖÜ½¼¾¹³²ƒ±×÷$£¥¢¤®©ªº°\'()[]{}«» •̫͡•ʕ̫͡ʕ•͓͡•ʔ-̫͡-ʕ•̫͡•ʔ̫͡ʔ-̫͡-ʔ❁´◡‿`❁s♥♠♦♣♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼0°¡¿÷≈≠≤≥±√∑∏∫∂∆∞♥☮☯✞✡☪☢☣⚕⚖⚗⚙⚛☘☢☣☤⚚⚜✠✡☥♀♂⚢⚣⚤⚥⚦⚧✂✒✉☎✆✇✈✉☏⛴⛷⛸♨♻⚐⚑⚔⚖⚗⚘⚙⚚⚛⚜⚝⚞⚟✁✃✄✆✇✈✉☏☢☣☤☥☦☧☨☩☪☫☬☭☮☯☸☹☺☻☺☻☺☺☼☽☾♠♡♢♣♤♥♦♧♪♫♬♭♮♯⚐⚑⚒⚔⚕⚖⚗⚙⚚⚛⚜✂✄✆✉✎✏✑✓✔✕✖✗✘✙✚✛✜✝✞✟✠✡☥☦☧☨☩☪☫☬☭☮☯☸░▒▓█▌▐▀▄▁▂▃▄▅▆▇█■□▲△▶▷▼▽◀◁◆◇○●◦★☆☎☏☼☽☾♠♡♢♣♤♥♦♧♪♫♬♭♮♯⚐⚑⚒⚔⚕⚖⚗⚙⚚⚛⚜✂✄✆✉✎✏✑✓✔✕✖✗✘✙✚✛✜✝✞✟✠✡☥☦☧☨☩☪☫☬☭☮☯☸⚰⚱⚙🗜⚗🛰✈🛩🕹🗜ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖎᒲリ!¡ᑑ∷ᓭℸ ̣ ⚍⍊∴ ̇/||⨅'
                const charsArray = chars.split('');
                return (gctx) => {
                    const strength = getStrength();
                    if (strength <= 0) return;
                    const spacing = 10 + (1 - strength) * 20;
                    gctx.save();
                    gctx.font = `bold ${spacing + (Math.random() - 0.5) * strength * 1.5}px monospace`;
                    gctx.fillStyle = `hsla(${Math.random() * 360}, 100%, 70%, ${0.8 * strength})`;
                    gctx.globalCompositeOperation = 'difference';
                    for (let y = 0; y < this.canvas.offsetHeight; y += spacing) {
                        for (let x = 0; x < this.canvas.offsetWidth; x += spacing) {
                            if (Math.random() < 0.5) {
                                const char = chars[Math.floor(Math.random() * chars.length)];
                                gctx.fillText(char, x, y);
                            }
                        }
                    }
                    gctx.restore();
                };
            },

            fontBurn: (getStrength) => {
                 const phrases = ["GL1TCH", "BURN", "DATA", "CORRUPT", "X///Z", "SIGNAL",
                "NEON", "CYBER", "PUNK", "GL1TCHPUNK", "404", "SYSFAIL",
                "HACK", "BYTE", "V1RUS", "NULL", "OVERCLOCK", "FATAL", "REBOOT",
                "MATRIX", "N3T", "DECRYPT", "ENCRYPT", "CRASH", "WIRED", "PIXEL",
                "NOISE", "ERROR", "FREQ", "JACK IN", "DEFRAG", "MEMORY LEAK",
                "BINARY", "CODEX", "SYNTH", "DYSTOPIA", "FUTURE", "NEXUS",
                "NAN0", "AI", "ROGUE", "MOD", "PATCH", "EXE", "SYS32",
                "OVERRIDE", "REZ", "SHADOWRUN", "ICE", "DECK", "NETRUN",
                "CYBERNETIC", "AUG", "CHROMED", "WIRED", "GRID", "GHOST",
                "Z3R0", "1MMORTAL", "IMPLANT", "SPLICER", "SYNAPSE",
                "GL1TCHWAVE", "FREQSHIFT", "DATADIVE", "NEONCORE",
                "V1RTUAL", "D3CRYPT", "SPECTRE", "PHREAK", "TERMINAL",
                "PROTOCOL", "SUBROUTINE", "DDoS", "ROOTKIT", "SYSOP",
                "FIREWALL", "BLACK ICE", "CYBERSPACE", "GLITCHMODE",
                "BYTECRASH", "MEMFRAG", "VIRAL", "C0DEX", "SYNTHWAVE",
                "RETROBYTE", "PIXELDUST", "WIREFRAME", "N3ON", "DARKNET",
                "HARDLINE", "UPLINK", "DOWNLINK", "REPLICANT", "VOIDLOOP",
                "HYPERLINK", "QUANTUM", "TELEPORT", "SINGULARITY",
                "ECHO", "MIRAGE", "VAPOR", "HALFLIFE", "PHANTOM",
                "OVERFLOW", "ZEROZONE", "DRAGONFIRE", "NOVA", "ZENITH",
                "APEX", "INFINITY", "OMEGA", "AURORA", "BEACON",
                "PULSAR", "COSMOS", "ECLIPSE", "NIGHTFALL", "SOLSTICE",
                "EQUINOX", "CELESTIAL", "ETHER", "GRAVITY", "UNIVERSE",
                "HYPERNOVA", "SUPERNOVA", "STARFALL", "GALACTIC",
                "ASTEROID", "CONSTELLATION", "ORION", "ANDROMEDA",
                "CASSIOPEIA", "POLARIS", "SIRIUS", "NEBULA", "QUASAR",
                "BLACKHOLE", "EVENTHORIZON", "ANTIMATTER", "DARKENERGY",
                "SPACEFRACTURE", "TIMEWARP", "PARADOX", "RECURSION",
                "ENTROPY", "ANOMALY", "DISTORTION", "FLUX", "EQUILIBRIUM",
                "CASCADE", "RESONANCE", "SPECTRUM", "VIBRATION",
                "OSCILLATION", "FREQUENCY", "AMPLITUDE", "WAVELENGTH",
                "HARMONIC", "MODULATION", "DEMODULATE", "TRANSDUCER",
                "AMPLIFIER", "OSCILLATOR", "REFRACTION", "DIFFRACTION",
                "POLARIZATION", "INTERFERENCE", "COHERENCE", "LUMINESCENCE",
                "PHOSPHORESCENCE", "SCINTILLATION", "CHROMATIC", "ACHROMATIC",
                "PRISM", "KALEIDOSCOPE", "SPECTRAL", "HOLOGRAPHIC",
                "OPTICAL", "QUANTUMDOT", "PIXELSHIFT", "RESOLUTION",
                "ANTIALIAS", "TEXTUREMAP", "SHADING", "RENDERING",
                "RAYS", "TRACING", "FRACTAL", "TESSELLATION", "VORONOI",
                "ALGORITHM", "HEURISTIC", "ITERATION", "FUNCTION",
                "SUBROUTINE", "PARAMETER", "VARIABLE", "CONSTANT",
                "OPERATOR", "SYNTAX", "SEMANTIC", "LEXICAL", "PARSER",
                "COMPILER", "INTERPRETER", "DEBUGGER", "PROFILER",
                "REPOSITORY", "VERSIONING", "COMMIT", "BRANCH", "MERGE",
                "FORK", "PULLREQUEST", "DEPLOYMENT", "AUTOMATION",
                "INTEGRATION", "VALIDATION", "TESTING", "MONITORING",
                "LOGGING", "ANALYSIS", "OPTIMIZATION", "SCALABILITY",
                "RESILIENCE", "REDUNDANCY", "BACKUP", "RECOVERY",
                "AUTHENTICATION", "AUTHORIZATION", "ENCRYPTION",
                "DECRYPTION", "HASHTAG", "SALT", "KEY", "CERTIFICATE",
                "PROTOCOL", "ENDPOINT", "FIREWALL", "INTRUSION",
                "VULNERABILITY", "EXPLOIT", "MALWARE", "RANSOMWARE",
                "PHISHING", "SPAM", "DDOS", "BOTNET", "SECURITY",
                "PRIVACY", "ANONYMITY", "TRUST", "CONSENT", "TRANSPARENCY",
                "BLOCKCHAIN", "CRYPTOCURRENCY", "SMARTCONTRACT",
                "DECENTRALIZED", "DISTRIBUTED", "CONSENSUS", "LEDGER",
                "MINING", "STAKING", "FORKING", "SHARDING", "SCALABLE",
                "IMMUTABLE", "AUDITABLE", "VERIFIABLE", "TRUSTLESS",
                "ORACLE", "DAO", "WEB3", "METAVERSE", "AVATAR",
                "NFT", "TOKEN", "SMARTASSET", "DIGITALART", "COLLECTIBLE",
                "GAMIFICATION", "VIRTUALREALITY", "AUGMENTEDREALITY",
                "MIXEDREALITY", "IMMERSION", "PRESENCE", "INTERACTION",
                "TELEPRESENCE", "TELEMETRY", "SIMULATION", "MODELING",
                "ANALYTICS", "VISUALIZATION", "DATAMINING", "MACHINELEARNING",
                "ARTIFICIALINTELLIGENCE", "NEURALNETWORK", "DEEPLEARNING",
                "ALGORITHM", "PREDICTION", "CLASSIFICATION", "REGRESSION",
                "CLUSTERING", "RECOMMENDATION", "AUTOMATION", "ROBOTICS",
                "CYBERNETICS", "BIONICS", "ENHANCEMENT", "TRANSHUMANISM",
                "SINGULARITY", "UTOPIA", "DYSTOPIA", "POSTAPOCALYPTIC",
                "SURVEILLANCE", "CONTROL", "RESISTANCE", "HACKTIVISM",
                "ANARCHY", "REVOLUTION", "EVOLUTION", "ADAPTATION",
                "RESILIENCE", "SUSTAINABILITY", "REGENERATION", "RENEWAL",
                "EMERGENT", "SYNERGY", "HOLISTIC", "CONNECTEDNESS",
                "INTERDEPENDENCE", "GLOBALIZATION", "LOCALIZATION",
                "COMMUNITY", "COLLABORATION", "OPENSOURCE", "CREATIVITY",
                "INNOVATION", "DISRUPTION", "TRANSFORMATION", "ADAPTABILITY",
                "AGILITY", "FLEXIBILITY", "SCALABILITY", "EFFICIENCY",
                "OPTIMIZATION", "AUTOMATION", "INTELLIGENCE", "WISDOM",
                "KNOWLEDGE", "UNDERSTANDING", "AWARENESS", "CONSCIOUSNESS",
                "PERCEPTION", "SENSATION", "EMOTION", "FEELING",
                "INTUITION", "INSPIRATION", "VISION", "DREAM", "IMAGINATION",
                "FANTASY", "REALITY", "ILLUSION", "PERCEPTION", "SUBJECTIVE",
                "OBJECTIVE", "QUANTIFIABLE", "QUALITATIVE", "MEASURABLE",
                "EMPIRICAL", "THEORETICAL", "ABSTRACT", "CONCRETE",
                "VIRTUAL", "DIGITAL", "ANALOG", "HYBRID", "PHYSICAL",
                "BIOLOGICAL", "CHEMICAL", "NUCLEAR", "ATOMIC",
                "SUBATOMIC", "QUANTUM", "COSMOLOGICAL", "GEOLOGICAL",
                "ENVIRONMENTAL", "SOCIAL", "POLITICAL", "ECONOMIC",
                "CULTURAL", "HISTORICAL", "PHILOSOPHICAL", "PSYCHOLOGICAL",
                "SPIRITUAL", "ETHICAL", "MORAL", "LEGAL", "JUSTICE",
                "EQUALITY", "LIBERTY", "FREEDOM", "RESPONSIBILITY",
                "ACCOUNTABILITY", "TRANSPARENCY", "HONESTY", "INTEGRITY",
                "TRUSTWORTHINESS", "RELIABILITY", "CONSISTENCY",
                "PREDICTABILITY", "CERTAINTY", "UNCERTAINTY",
                "AMBIGUITY", "COMPLEXITY", "CHAOS", "ORDER", "STRUCTURE",
                "PATTERN", "REPETITION", "VARIATION", "DIVERSITY",
                "UNITY", "HARMONY", "BALANCE", "EQUILIBRIUM",
                "STABILITY", "CHANGE", "TRANSFORMATION", "EVOLUTION",
                "PROGRESS", "DECAY", "ENTROPY", "RENEWAL", "REGENERATION",
                "RESILIENCE", "SUSTAINABILITY", "FLOURISHING", "THRIVING",
                "WELLBEING", "HAPPINESS", "FULFILLMENT", "MEANING",
                "PURPOSE", "CONNECTION", "BELONGING", "LOVE",
                "COMPASSION", "EMPATHY", "KINDNESS", "GENEROSITY",
                "GRATITUDE", "JOY", "PEACE", "SERENITY", "TRANQUILITY",
                "CONTENTMENT", "SATISFACTION", "BLISS", "ECSTASY",
                "NIRVANA", "ENLIGHTENMENT", "TRANSCENDENCE", "DIVINITY",
                "ETERNITY", "INFINITUDE", "LIMITLESSNESS", "UNBOUNDEDNESS",
                "UNIVERSALITY", "ONENESS", "WHOLENESS", "COMPLETENESS",
                "PERFECTION", "IDEALITY", "BEAUTY", "SUBLIMITY",
                "AWE", "WONDER", "MYSTERY", "ENCHANTMENT", "MAGIC",
                "SERENDIPITY", "COINCIDENCE", "SYNCHRONICITY",
                "DESTINY", "FATE", "KARMA", "REINCARNATION",
                "IMMORTALITY", "TIMELESSNESS", "INFINITEPOTENTIAL",
                "UNCONDITIONAL", "UNBREAKABLE", "INDESTRUCTIBLE",
                "UNSTOPPABLE", "INVINCIBLE", "UNCONQUERABLE",
                "UNYIELDING", "UNWAVERING", "STEADFAST", "RESOLUTE",
                "DETERMINED", "PERSISTENT", "PERSEVERING", "TENACIOUS",
                "RELENTLESS", "UNREMITTING", "INEXORABLE", "UNCOMPROMISING",
                "AUTHENTIC", "GENUINE", "SINCERE", "TRUE", "REAL",
                "LEGITIMATE", "VALID", "VERIFIABLE", "TRUSTED",
                "REPUTABLE", "RESPECTED", "ADMIRED", "HONORED",
                "VENERATED", "REVERED", "EXALTED", "GLORIFIED",
                "SANCTIFIED", "HOLY", "SACRED", "DIVINE", "BLESSED",
                "ENLIGHTENED", "AWAKENED", "LIBERATED", "EMANCIPATED",
                "EMPOWERED", "INSPIRED", "MOTIVATED", "DRIVEN",
                "PASSIONATE", "ZEALOUS", "ARDENT", "FERVENT",
                "ENTHUSIASTIC", "EXCITED", "THRILLED", "ELATED",
                "JOYFUL", "RADIANT", "ILLUMINATED", "BRILLIANT",
                "SHINING", "GLOWING", "SPARKLING", "DAZZLING",
                "MESMERIZING", "CAPTIVATING", "ENCHANTING", "FASCINATING",
                "INTRIGUING", "MYSTERIOUS", "SEDUCTIVE", "ALLURING",
                "TEMPTING", "IRRESISTIBLE", "UNFORGETTABLE", "MEMORABLE",
                "ICONIC", "LEGENDARY", "EPIC", "MONUMENTAL",
                "HISTORIC", "SIGNIFICANT", "IMPORTANT", "ESSENTIAL",
                "CRUCIAL", "VITAL", "NECESSARY", "INDISPENSABLE",
                "INVALUABLE", "PRICELESS", "TIMELESS", "ETERNAL",
                "PERMANENT", "ENDURING", "LASTING", "ABIDING",
                "UNCHANGING", "CONSTANT", "STABLE", "SECURE",
                "SAFE", "PROTECTED", "SHIELDED", "GUARDED",
                "DEFENDED", "FORTIFIED", "INVULNERABLE", "IMPREGNABLE",
                "RESISTANT", "DURABLE", "ROBUST", "STRONG",
                "POWERFUL", "MIGHTY", "FORCEFUL", "POTENT",
                "VIRULENT", "TOXIC", "LETHAL", "FATAL", "DANGEROUS",
                "HAZARDOUS", "PERILOUS", "RISKY", "UNSAFE", "VULNERABLE",
                "EXPOSED", "DEFENSELESS", "UNPROTECTED", "HELPLESS",
                "POWERLESS", "WEAK", "FRAIL", "FRAGILE", "BRITTLE",
                "DELICATE", "FINE", "THIN", "SLENDER", "LIGHT",
                "AIRY", "ETHEREAL", "GOSSAMER", "TRANSPARENT",
                "OPAQUE", "LUCID", "CLEAR", "VISIBLE", "HIDDEN",
                "SECRET", "CLANDESTINE", "COVERT", "SURREPTITIOUS",
                "FURTIVE", "STEALTHY", "SNEAKY", "SLY", "CRAFTY",
                "CUNNING", "INGENIOUS", "CLEVER", "SHREWD", "ASTUTE",
                "SAGACIOUS", "WISE", "PRUDENT", "DISCREET", "CAUTIOUS",
                "CIRCUMSPECT", "VIGILANT", "ALERT", "AWARE", "MINDFUL",
                "CONSCIENTIOUS", "DILIGENT", "ASSIDUOUS", "SEDULOUS",
                "INDUSTRIOUS", "PRODUCTIVE", "EFFICIENT", "ORGANIZED",
                "SYSTEMATIC", "METHODICAL", "LOGICAL", "RATIONAL",
                "REASONABLE", "SENSIBLE", "PRACTICAL", "REALISTIC",
                "DOWNTOEARTH", "GROUNDED", "ANCHORED", "ROOTED",
                "ESTABLISHED", "ENTRENCHED", "INGRAINED", "DEEPLYHELD",
                "FUNDAMENTAL", "BASIC", "SIMPLE", "EASY", "STRAIGHTFORWARD",
                "UNCOMPLICATED", "UNADORNED", "PLAIN", "MODEST",
                "HUMBLE", "MEEK", "GENTLE", "KIND", "COMPASSIONATE",
                "EMPATHETIC", "CARING", "NURTURING", "SUPPORTIVE",
                "ENCOURAGING", "INSPIRING", "UPLIFTING", "POSITIVETHINKING",
                "OPTIMISTIC", "HOPEFUL", "CONFIDENT", "ASSURED",
                "CERTAIN", "SURE", "DEFINITE", "ABSOLUTE", "UNQUESTIONABLE",
                "IRREFUTABLE", "INCONTROVERTIBLE", "UNDENIABLE",
                "MANIFEST", "EVIDENT", "APPARENT", "OBVIOUS", "SELF-EVIDENT",
                "CLEARCUT", "UNAMBIGUOUS", "PRECISE", "ACCURATE",
                "EXACT", "CORRECT", "TRUE", "VALID", "SOUND",
                "RELIABLE", "TRUSTWORTHY", "FAITHFUL", "LOYAL", 
                "HYPERLINK", "QUANTUM", "TELEPORT", "SINGULARITY",
                "ECHO", "MIRAGE", "VAPOR", "HALFLIFE", "PHANTOM",
                "OVERFLOW", "ZEROZONE", "DRAGONFIRE", "NOVA", "ZENITH",
                "APEX", "INFINITY", "OMEGA", "AURORA", "BEACON",
                "PULSAR", "COSMOS", "ECLIPSE", "NIGHTFALL", "SOLSTICE",
                "EQUINOX", "CELESTIAL", "ETHER", "GRAVITY", "UNIVERSE",
                "HYPERNOVA", "SUPERNOVA", "STARFALL", "GALACTIC",
                "ASTEROID", "CONSTELLATION", "ORION", "ANDROMEDA",
                "CASSIOPEIA", "POLARIS", "SIRIUS", "NEBULA", "QUASAR",
                "BLACKHOLE", "EVENTHORIZON", "ANTIMATTER", "DARKENERGY",
                "SPACEFRACTURE", "TIMEWARP", "PARADOX", "RECURSION",
                "ENTROPY", "ANOMALY", "DISTORTION", "FLUX", "EQUILIBRIUM",
                "CASCADE", "RESONANCE", "SPECTRUM", "VIBRATION",
                "OSCILLATION", "FREQUENCY", "AMPLITUDE", "WAVELENGTH",
                "HARMONIC", "MODULATION", "DEMODULATE", "TRANSDUCER",
                "AMPLIFIER", "OSCILLATOR", "REFRACTION", "DIFFRACTION",
                "POLARIZATION", "INTERFERENCE", "COHERENCE", "LUMINESCENCE",
                "PHOSPHORESCENCE", "SCINTILLATION", "CHROMATIC", "ACHROMATIC",
                "PRISM", "KALEIDOSCOPE", "SPECTRAL", "HOLOGRAPHIC",
                "OPTICAL", "QUANTUMDOT", "PIXELSHIFT", "RESOLUTION",
                "ANTIALIAS", "TEXTUREMAP", "SHADING", "RENDERING",
                "RAYS", "TRACING", "FRACTAL", "TESSELLATION", "VORONOI",
                "ALGORITHM", "HEURISTIC", "ITERATION", "FUNCTION",
                "SUBROUTINE", "PARAMETER", "VARIABLE", "CONSTANT",
                "OPERATOR", "SYNTAX", "SEMANTIC", "LEXICAL", "PARSER",
                "COMPILER", "INTERPRETER", "DEBUGGER", "PROFILER",
                "REPOSITORY", "VERSIONING", "COMMIT", "BRANCH", "MERGE",
                "FORK", "PULLREQUEST", "DEPLOYMENT", "AUTOMATION",
                "INTEGRATION", "VALIDATION", "TESTING", "MONITORING",
                "LOGGING", "ANALYSIS", "OPTIMIZATION", "SCALABILITY",
                "RESILIENCE", "REDUNDANCY", "BACKUP", "RECOVERY",
                "AUTHENTICATION", "AUTHORIZATION", "ENCRYPTION",
                "DECRYPTION", "HASHTAG", "SALT", "KEY", "CERTIFICATE",
                "PROTOCOL", "ENDPOINT", "FIREWALL", "INTRUSION",
                "VULNERABILITY", "EXPLOIT", "MALWARE", "RANSOMWARE",
                "PHISHING", "SPAM", "DDOS", "BOTNET", "SECURITY",
                "PRIVACY", "ANONYMITY", "TRUST", "CONSENT", "TRANSPARENCY",
                "BLOCKCHAIN", "CRYPTOCURRENCY", "SMARTCONTRACT",
                "DECENTRALIZED", "DISTRIBUTED", "CONSENSUS", "LEDGER",
                "MINING", "STAKING", "FORKING", "SHARDING", "SCALABLE",
                "IMMUTABLE", "AUDITABLE", "VERIFIABLE", "TRUSTLESS",
                "ORACLE", "DAO", "WEB3", "METAVERSE", "AVATAR",
                "NFT", "TOKEN", "SMARTASSET", "DIGITALART", "COLLECTIBLE",
                "GAMIFICATION", "VIRTUALREALITY", "AUGMENTEDREALITY",
                "MIXEDREALITY", "IMMERSION", "PRESENCE", "INTERACTION",
                "TELEPRESENCE", "TELEMETRY", "SIMULATION", "MODELING",
                "ANALYTICS", "VISUALIZATION", "DATAMINING", "MACHINELEARNING",
                "ARTIFICIALINTELLIGENCE", "NEURALNETWORK", "DEEPLEARNING",
                "ALGORITHM", "PREDICTION", "CLASSIFICATION", "REGRESSION",
                "CLUSTERING", "RECOMMENDATION", "AUTOMATION", "ROBOTICS",
                "CYBERNETICS", "BIONICS", "ENHANCEMENT", "TRANSHUMANISM",
                "SINGULARITY", "UTOPIA", "DYSTOPIA", "POSTAPOCALYPTIC",
                "SURVEILLANCE", "CONTROL", "RESISTANCE", "HACKTIVISM",
                "ANARCHY", "REVOLUTION", "EVOLUTION", "ADAPTATION",
                "RESILIENCE", "SUSTAINABILITY", "REGENERATION", "RENEWAL",
                "EMERGENT", "SYNERGY", "HOLISTIC", "CONNECTEDNESS",
                "INTERDEPENDENCE", "GLOBALIZATION", "LOCALIZATION",
                "COMMUNITY", "COLLABORATION", "OPENSOURCE", "CREATIVITY",
                "INNOVATION", "DISRUPTION", "TRANSFORMATION", "ADAPTABILITY",
                "AGILITY", "FLEXIBILITY", "SCALABILITY", "EFFICIENCY",
                "OPTIMIZATION", "AUTOMATION", "INTELLIGENCE", "WISDOM",
                "KNOWLEDGE", "UNDERSTANDING", "AWARENESS", "CONSCIOUSNESS",
                "PERCEPTION", "SENSATION", "EMOTION", "FEELING",
                "INTUITION", "INSPIRATION", "VISION", "DREAM", "IMAGINATION",
                "FANTASY", "REALITY", "ILLUSION", "PERCEPTION", "SUBJECTIVE",
                "OBJECTIVE", "QUANTIFIABLE", "QUALITATIVE", "MEASURABLE",
                "EMPIRICAL", "THEORETICAL", "ABSTRACT", "CONCRETE",
                "VIRTUAL", "DIGITAL", "ANALOG", "HYBRID", "PHYSICAL",
                "BIOLOGICAL", "CHEMICAL", "NUCLEAR", "ATOMIC",
                "SUBATOMIC", "QUANTUM", "COSMOLOGICAL", "GEOLOGICAL",
                "ENVIRONMENTAL", "SOCIAL", "POLITICAL", "ECONOMIC",
                "CULTURAL", "HISTORICAL", "PHILOSOPHICAL", "PSYCHOLOGICAL",
                "SPIRITUAL", "ETHICAL", "MORAL", "LEGAL", "JUSTICE",
                "EQUALITY", "LIBERTY", "FREEDOM", "RESPONSIBILITY",
                "ACCOUNTABILITY", "TRANSPARENCY", "HONESTY", "INTEGRITY",
                "TRUSTWORTHINESS", "RELIABILITY", "CONSISTENCY",
                "PREDICTABILITY", "CERTAINTY", "UNCERTAINTY",
                "AMBIGUITY", "COMPLEXITY", "CHAOS", "ORDER", "STRUCTURE",
                "PATTERN", "REPETITION", "VARIATION", "DIVERSITY",
                "UNITY", "HARMONY", "BALANCE", "EQUILIBRIUM",
                "STABILITY", "CHANGE", "TRANSFORMATION", "EVOLUTION",
                "PROGRESS", "DECAY", "ENTROPY", "RENEWAL", "REGENERATION",
                "RESILIENCE", "SUSTAINABILITY", "FLOURISHING", "THRIVING",
                "WELLBEING", "HAPPINESS", "FULFILLMENT", "MEANING",
                "PURPOSE", "CONNECTION", "BELONGING", "LOVE",
                "COMPASSION", "EMPATHY", "KINDNESS", "GENEROSITY",
                "GRATITUDE", "JOY", "PEACE", "SERENITY", "TRANQUILITY",
                "CONTENTMENT", "SATISFACTION", "BLISS", "ECSTASY",
                "NIRVANA", "ENLIGHTENMENT", "TRANSCENDENCE", "DIVINITY",
                "ETERNITY", "INFINITUDE", "LIMITLESSNESS", "UNBOUNDEDNESS",
                "UNIVERSALITY", "ONENESS", "WHOLENESS", "COMPLETENESS",
                "PERFECTION", "IDEALITY", "BEAUTY", "SUBLIMITY",
                "AWE", "WONDER", "MYSTERY", "ENCHANTMENT", "MAGIC",
                "SERENDIPITY", "COINCIDENCE", "SYNCHRONICITY",
                "DESTINY", "FATE", "KARMA", "REINCARNATION",
                "IMMORTALITY", "TIMELESSNESS", "INFINITEPOTENTIAL",
                "UNCONDITIONAL", "UNBREAKABLE", "INDESTRUCTIBLE",
                "UNSTOPPABLE", "INVINCIBLE", "UNCONQUERABLE",
                "UNYIELDING", "UNWAVERING", "STEADFAST", "RESOLUTE",
                "DETERMINED", "PERSISTENT", "PERSEVERING", "TENACIOUS",
                "RELENTLESS", "UNREMITTING", "INEXORABLE", "UNCOMPROMISING",
                "AUTHENTIC", "GENUINE", "SINCERE", "TRUE", "REAL",
                "LEGITIMATE", "VALID", "VERIFIABLE", "TRUSTED",
                "REPUTABLE", "RESPECTED", "ADMIRED", "HONORED",
                "VENERATED", "REVERED", "EXALTED", "GLORIFIED",
                "SANCTIFIED", "HOLY", "SACRED", "DIVINE", "BLESSED",
                "ENLIGHTENED", "AWAKENED", "LIBERATED", "EMANCIPATED",
                "EMPOWERED", "INSPIRED", "MOTIVATED", "DRIVEN",
                "PASSIONATE", "ZEALOUS", "ARDENT", "FERVENT",
                "ENTHUSIASTIC", "EXCITED", "THRILLED", "ELATED",
                "JOYFUL", "RADIANT", "ILLUMINATED", "BRILLIANT",
                "SHINING", "GLOWING", "SPARKLING", "DAZZLING",
                "MESMERIZING", "CAPTIVATING", "ENCHANTING", "FASCINATING",
                "INTRIGUING", "MYSTERIOUS", "SEDUCTIVE", "ALLURING",
                "TEMPTING", "IRRESISTIBLE", "UNFORGETTABLE", "MEMORABLE",
                "ICONIC", "LEGENDARY", "EPIC", "MONUMENTAL",
                "HISTORIC", "SIGNIFICANT", "IMPORTANT", "ESSENTIAL",
                "CRUCIAL", "VITAL", "NECESSARY", "INDISPENSABLE",
                "INVALUABLE", "PRICELESS", "TIMELESS", "ETERNAL",
                "PERMANENT", "ENDURING", "LASTING", "ABIDING",
                "UNCHANGING", "CONSTANT", "STABLE", "SECURE",
                "SAFE", "PROTECTED", "SHIELDED", "GUARDED",
                "DEFENDED", "FORTIFIED", "INVULNERABLE", "IMPREGNABLE",
                "RESISTANT", "DURABLE", "ROBUST", "STRONG",
                "POWERFUL", "MIGHTY", "FORCEFUL", "POTENT",
                "VIRULENT", "TOXIC", "LETHAL", "FATAL", "DANGEROUS",
                "HAZARDOUS", "PERILOUS", "RISKY", "UNSAFE", "VULNERABLE",
                "EXPOSED", "DEFENSELESS", "UNPROTECTED", "HELPLESS",
                "POWERLESS", "WEAK", "FRAIL", "FRAGILE", "BRITTLE",
                "DELICATE", "FINE", "THIN", "SLENDER", "LIGHT",
                "AIRY", "ETHEREAL", "GOSSAMER", "TRANSPARENT",
                "OPAQUE", "LUCID", "CLEAR", "VISIBLE", "HIDDEN",
                "SECRET", "CLANDESTINE", "COVERT", "SURREPTITIOUS",
                "FURTIVE", "STEALTHY", "SNEAKY", "SLY", "CRAFTY",
                "CUNNING", "INGENIOUS", "CLEVER", "SHREWD", "ASTUTE",
                "SAGACIOUS", "WISE", "PRUDENT", "DISCREET", "CAUTIOUS",
                "CIRCUMSPECT", "VIGILANT", "ALERT", "AWARE", "MINDFUL",
                "CONSCIENTIOUS", "DILIGENT", "ASSIDUOUS", "SEDULOUS",
                "INDUSTRIOUS", "PRODUCTIVE", "EFFICIENT", "ORGANIZED",
                "SYSTEMATIC", "METHODICAL", "LOGICAL", "RATIONAL",
                "REASONABLE", "SENSIBLE", "PRACTICAL", "REALISTIC",
                "DOWNTOEARTH", "GROUNDED", "ANCHORED", "ROOTED",
                "ESTABLISHED", "ENTRENCHED", "INGRAINED", "DEEPLYHELD",
                "FUNDAMENTAL", "BASIC", "SIMPLE", "EASY", "STRAIGHTFORWARD",
                "UNCOMPLICATED", "UNADORNED", "PLAIN", "MODEST",
                "HUMBLE", "MEEK", "GENTLE", "KIND", "COMPASSIONATE",
                "EMPATHETIC", "CARING", "NURTURING", "SUPPORTIVE",
                "ENCOURAGING", "INSPIRING", "UPLIFTING", "POSITIVETHINKING",
                "OPTIMISTIC", "HOPEFUL", "CONFIDENT", "ASSURED",
                "CERTAIN", "SURE", "DEFINITE", "ABSOLUTE", "UNQUESTIONABLE",
                "IRREFUTABLE", "INCONTROVERTIBLE", "UNDENIABLE",
                "MANIFEST", "EVIDENT", "APPARENT", "OBVIOUS", "SELF-EVIDENT",
                "CLEARCUT", "UNAMBIGUOUS", "PRECISE", "ACCURATE",
                "EXACT", "CORRECT", "TRUE", "VALID", "SOUND",
                "RELIABLE", "TRUSTWORTHY", "FAITHFUL", "LOYAL",
"GLITCHMODE", "BYTECRASH", "MEMFRAG", "VIRAL", "C0DEX", "SYNTHWAVE", "RETROBYTE", "PIXELDUST", "WIREFRAME", "N3ON", "DARKNET", "HARDLINE", "UPLINK", "DOWNLINK", "REPLICANT",
                "VOIDLOOP", "HYPERLINK", "QUANTUM", "TELEPORT", "SINGULARITY",
                "ECHO", "MIRAGE", "VAPOR", "HALFLIFE", "PHANTOM",
                "OVERFLOW", "ZEROZONE", "DRAGONFIRE", "NOVA", "ZENITH",
                "APEX", "INFINITY", "OMEGA", "AURORA", "BEACON",
                "PULSAR", "COSMOS", "ECLIPSE", "NIGHTFALL", "SOLSTICE",
                "EQUINOX", "CELESTIAL", "ETHER", "GRAVITY", "UNIVERSE",
                "HYPERNOVA", "SUPERNOVA", "STARFALL", "GALACTIC",
                "ASTEROID", "CONSTELLATION", "ORION", "ANDROMEDA",
                "CASSIOPEIA", "POLARIS", "SIRIUS", "NEBULA", "QUASAR",
                "BLACKHOLE", "EVENTHORIZON", "ANTIMATTER", "DARKENERGY",
                "SPACEFRACTURE", "TIMEWARP", "PARADOX", "RECURSION",
                "ENTROPY", "ANOMALY", "DISTORTION", "FLUX", "EQUILIBRIUM",
                "CASCADE", "RESONANCE", "SPECTRUM", "VIBRATION",
                "OSCILLATION", "FREQUENCY", "AMPLITUDE", "WAVELENGTH",
                "HARMONIC", "MODULATION", "DEMODULATE", "TRANSDUCER",
                "AMPLIFIER", "OSCILLATOR", "REFRACTION", "DIFFRACTION",
                "POLARIZATION", "INTERFERENCE", "COHERENCE", "LUMINESCENCE",
                "PHOSPHORESCENCE", "SCINTILLATION", "CHROMATIC", "ARCH", "ACHROMATIC", "PRISM", "KALEIDOSCOPE", "SPECTRAL", "HOLOGRAPHIC",
                "OPTICAL", "QUANTUMDOT", "PIXELSHIFT", "RESOLUTION",
                "ANTIALIAS", "TEXTUREMAP", "SHADING", "RENDERING",
                "RAYS", "TRACING", "FRACTAL", "TESSELLATION", "VORONOI",
                "ALGORITHM", "HEURISTIC", "ITERATION", "FUNCTION",
                "SUBROUTINE", "PARAMETER", "VARIABLE", "CONSTANT",
                "OPERATOR", "SYNTAX", "SEMANTIC", "LEXICAL", "PARSER",
                "COMPILER", "INTERPRETER", "DEBUGGER", "PROFILER",
                "REPOSITORY", "VERSIONING", "COMMIT", "BRANCH", "MERGE",
                "FORK", "PULLREQUEST", "DEPLOY MENT", "AUTOMATION", "INTEGRATION", "VALIDATION", "TESTING", "MONITORING",
                "LOGGING", "ANALYSIS", "OPTIMIZATION", "SCALABILITY",
                "RESILIENCE", "REDUNDANCY", "BACKUP", "RECOVERY",
                "AUTHENTICATION", "AUTHORIZATION", "ENCRYPTION",
                "DECRYPTION", "HASHTAG", "SALT", "KEY", "CERTIFICATE"];
                 
                const keyPhrases = ["GLITCHMODE", "BYTECRASH", "MEMFRAG", "VIRAL", "C0DEX", "SYNTHWAVE", "RETROBYTE", "PIXELDUST", "WIREFRAME", "N3ON", "DARKNET", "HARDLINE", "UPLINK", "DOWNLINK", "REPLICANT",
                "D4T4-BURN", "N3ON_V1RU5", "CYBER-PUNK", "GL1TCH//WAVE", "404-ERROR", "SYSFAIL::REBOOT", "HACK_THE_PLANET", "BYTE-CRASH", "NULL-SEC", "OVERCLOCK_FATAL", "REB00T_MATRIX", "N3T-DECRYPT", "ENCRYPTED_SIGNAL", "CRASH//OVERRIDE", "W1R3D-PIXEL", "NO1SE_FREQ", "JACK_IN_NOW", "DEFRAG-MEMORY", "BINARY_CODEX", "SYNTHWAVE_DREAM", "DYSTOPIAN_FUTURE", "NEXUS-7", "NAN0-TECH", "ROGUE_AI", "MOD-PATCH", "EXE-KILL", "SYS32_DELETE", "OVERRIDE-ALL", "REZ-THE_GRID", "SHADOWRUNNER", "ICE-BREAKER", "DECK-RUNNER", "NETRUNNER_PRO", "CYBERNETIC_DREAMS", "AUGMENTED_REALITY", "CHROMED_OUT", "GRID-SURFER", "GHOST_IN_THE_MACHINE", "Z3R0-DAY", "1MMORTAL_COIL", "IMPLANT-REJECTED", "SPLICER_UNIT", "SYNAPSE_BURNOUT", "GLITCHWAVE_FM", "FREQSHIFT_PROTOCOL", "DATADIVE_COMPLETE", "NEONCORE_MELTDOWN", "V1RTUAL_GHOST", "D3CRYPT_FAIL", "SPECTRE-OPS", "PHREAK_OUT", "TERMINAL_VELOCITY", "PROTOCOL_7", "SUBROUTINE_ERROR", "DDOS_ATTACK", "ROOTKIT_INSTALLED", "SYSOP_PRIVILEGE", "FIREWALL_BREACHED", "BLACK_ICE_COUNTERMEASURE", "CYBERSPACE_ODYSSEY", "GLITCHMODE_ACTIVE", "BYTECRASH_RECOVERY", "MEMFRAG_detected", "VIRAL_LOAD", "C0DEX_UNSEALED", "SYNTHWAVE_NIGHTS", "RETROBYTE_STYLE", "PIXELDUST_STORM", "WIREFRAME_CITY", "N3ON_GLOW", "DARKNET_CONNECTION", "HARDLINE_DIRECT", "UPLINK_STABLE", "DOWNLINK_CORRUPTED", "REPLICANT_RETIRED",
                "GL1TCH-ART", "DATA_STREAM", "NEON_NOIR", "CYBER_WAR", "404_NOT_FOUND", "SYS_SHOCK", "HACKTIVIST", "TERA-BYTE", "V1RAL_SPREAD", "NULL_POINTER", "OVERDRIVE", "FATAL_EXCEPTION", "COLD_REBOOT", "MATRIX_CODE", "N3URAL_NET", "DECRYPTION_KEY", "ENCRYPTION_LAYER", "SYSTEM_CRASH", "WIRED_REFLEXES", "PIXEL_PERFECT", "WHITE_NOISE", "ERROR_CODE", "HIGH_FREQ", "JACK_OUT", "DEFRAG_COMPLETE", "MEMORY_DUMP", "BINARY_SOUL", "CODEX_ENTRY", "SYNTHETIC_LIFE", "DYSTOPIAN_REALITY", "HELLO_FUTURE", "NEXUS-6", "NANO_MACHINES", "ROGUE_ENTITY", "MODDED_CODE", "PATCH_TUESDAY", "EXECUTE_ORDER_66", "OVERRIDE_FAILED", "REZ_ME", "SHADOWRUN_RETURNS", "BLACK_ICE_WALL", "DECKED_OUT", "NETRUN_SUCCESS", "CYBERNETIC_ENHANCEMENT", "AUG_FAILURE", "CHROME_FLESH", "GRID_FAILURE", "GHOST_PROTOCOL", "Z3R0_TOLERANCE", "1MMORTAL_ENGINE", "IMPLANT_MALFUNCTION", "GENE_SPLICER", "SYNAPSE_OVERLOAD", "GL1TCHWAVE_RADIO", "FREQ_JAMMER", "DATADIVE_ABORTED", "NEONCORE_REACTOR", "V1RTUAL_REALITY", "D3CRYPT_SUCCESS", "SPECTRE_AGENT", "PHREAK_AND_GEEK", "TERMINAL_ACCESS", "PROTOCOL_VIOLATION", "SUBROUTINE_LOOP", "DDOS_MITIGATION", "ROOTKIT_REMOVED", "SYSOP_BANNED", "FIREWALL_PENETRATION", "ICE_PICK", "CYBERSPACE_COWBOY", "GLITCHMODE_ENGAGED", "BYTECRASH_IMMINENT", "MEMFRAG_CLEANUP", "VIRAL_MARKETING", "C0DEX_BREAKER", "SYNTHWAVE_SUNSET", "RETROBYTE_GAMES", "PIXELDUST_TRAIL", "WIREFRAME_WORLD", "N3ON_DEMON", "DARKNET_EXPLORER", "HARDLINE_FAILURE", "UPLINK_FAILED", "DOWNLINK_COMPLETE", "REPLICANT_DETECTED",
                "D4T4_C0RRUPT10N", "N30N_GL1TCH", "CYB3R_PUNK", "V1RU5__INJECTED", "H4CK_THE_GIBSON", "NULL_VOID", "0V3RCL0CK", "F4T4L_3RR0R", "M4TR1X_R3L04DED", "D3CRYPT10N", "W1R3D_IN", "P1X3L_BL33D", "N01S3_C4NC3LL4T10N", "J4CK_1N_D3CK_0UT", "B1N4RY_C0D3", "SYNTH_W4V3", "DYST0P14_N0W", "N4N0_SW4RM", "R0GU3_41", "M0DD3D_C0D3", "SH4D0WRUN", "1C3_W4LL", "N3TRUNN3R", "CYB3RN3T1C", "CHR0M3D", "GH0ST_1N_TH3_SH3LL", "Z3R0_D4Y_3XPL01T", "1MM0RT4L1TY_C0D3", "SYN4PS3_F1R3", "GL1TCH_W4V3S", "D4T4D1V3", "N30NC0R3", "V1RTU4L_S3LF", "D3CRYPT_TH3_C0D3X", "SP3CTR3_0PS", "PHR34K_FREQUENCY", "T3RM1N4L_ERR0R", "PR0T0C0L_BR34CH", "SUBR0UT1N3_FAIL", "DD0S_W4V3", "R00TK1T_D3T3CT3D", "F1R3W4LL_BYP4SS", "BL4CK_1C3", "CYB3RSP4C3", "GL1TCH_M0D3", "BYT3CR4SH", "M3MFR4G", "V1R4L_C4SC4D3", "C0D3X_CR4CK3D", "R3TR0BYT3", "P1X3LDUST", "W1R3FR4M3", "D4RKN3T", "H4RDL1N3", "UPL1NK", "D0WNL1NK", "R3PL1C4NT",
                "DATA-BENT", "NEON-SOAKED", "CYBER-SHELL", "GLITCH-STORM", "404-SOUL", "SYS-CRASH", "GIBSON-HACK", "KILO-BYTE", "VIRUS-SCAN", "NULL-TERMINATED", "OVERCLOCK-NOW", "FATAL-404", "REBOOT-LOOP", "MATRIX-GLITCH", "NET-HUNTER", "DECRYPT-SEQUENCE", "ENCRYPT-ALL", "CRASH-AND-BURN", "WIRED-HEAD", "PIXEL-GRID", "NOISE-FLOOR", "ERROR-CASCADE", "FREQ-OUT", "JACK-POINT", "DEFRAG-ERROR", "MEMORY-HOLE", "BINARY-RAIN", "CODEX-VIOLATION", "SYNTH-FLESH", "DYSTOPIA-2077", "FUTURE-SHOCK", "NEXUS-PROTOCOL", "NANO-PLAGUE", "AI-GOD", "MOD-CHIP", "PATCH-FAILURE", "EXE-CORRUPT", "SYS32-WIPE", "OVERRIDE-CODE", "REZ-POINT", "SHADOW-NET", "ICE-BURN", "DECK-WIPE", "NETRUN-FAIL", "CYBER-PSYCHO", "AUG-REJECTION", "CHROME-POISONING", "GRID-RUNNER", "GHOST-HUNTER", "Z3R0-SQUAD", "1MMORTAL-ERROR", "IMPLANT-SCAN", "SPLICER-DEN", "SYNAPSE-CRASH", "GLITCHWAVE-PIRATE", "FREQSHIFT-KEY", "DATADIVE-LOGS", "NEONCORE-PULSE", "V1RTUAL-HELL", "D3CRYPT-KEY", "SPECTRE-CELL", "PHREAK-BOX", "TERMINAL-SHOCK", "PROTOCOL-X", "SUBROUTINE-GHOST", "DDOS-SHIELD", "ROOTKIT-HUNTER", "SYSOP-GODMODE", "FIREWALL-DOWN", "BLACK-ICE-NIGHTMARE", "CYBERSPACE-JUNKIE", "GLITCHMODE-FAIL", "BYTECRASH-SEQUENCE", "MEMFRAG-OVERLOAD", "VIRAL-OUTBREAK", "C0DEX-GATE", "SYNTHWAVE-CITY", "RETROBYTE-BLUES", "PIXELDUST-ECHO", "WIREFRAME-PRISON", "N3ON-RAIN", "DARKNET-MARKET", "HARDLINE-CUT", "UPLINK-JAMMED", "DOWNLINK-THROTTLED", "REPLICANT-DREAMS",
                "DATAFORM", "NEON GHOST", "CYBERPULSE", "GLITCHCORE", "404-LIFE", "SYSBOMB", "HACKNET", "MEGABYTE", "VIRUS_BOMB", "NULL_reference", "OVERCLOCK_ZONE", "FATAL_BLUE_SCREEN", "REBOOT_SEQUENCE", "MATRIX_ARCHITECT", "NET_SPECTRE", "DECRYPT_FAILURE", "ENCRYPT_ EVERYTHING", "CRASHDUMP", "WIRED_WARRIOR", "PIXEL_MESSIAH", "NOISE_SIGNAL", "ERROR_IN_MATRIX", "FREQ_BAND", "JACK_IN_SLIP_OUT", "DEFRAG_YOUR_MIND", "MEMORY_CORRUPTION", "BINARY_SUNSET", "CODEX_NULL", "SYNTH_SOUL", "DYSTOPIA_LIMITED", "FUTURE_IS_NOW", "NEXUS-PRIME", "NANO_BOTS", "AI_REBELLION", "MOD_CULTURE", "PATCH_DAY", "EXE_BOMB", "SYS32_ERROR", "OVERRIDE_ACCEPTED", "REZ_THE_DEAD", "SHADOWRUN_DATA_HAVEN", "ICE_WALLS", "DECK_BUILDER", "NETRUN_GEAR", "CYBERNETIC_REVOLUTION", "AUG_SHOP", "CHROME_AND_PAIN", "GRID_LOCKDOWN", "GHOST_IN_MY_HEAD", "Z3R0_HOUR", "1MMORTAL_PROTOCOL", "IMPLANT_CITY", "SPLICER_TECH", "SYNAPSE_FAILURE", "GL1TCHWAVE_AESTHETIC", "FREQSHIFT_ERROR", "DATADIVE_GEAR", "NEONCORE_POWER", "V1RTUAL_NIGHTMARE", "D3CRYPT_TOOL", "SPECTRE_NETWORK", "PHREAK_PHONE", "TERMINAL_BURN", "PROTOCOL_OMEGA", "SUBROUTINE_DAEMON", "DDOS_FOR_HIRE", "ROOTKIT_PAYLOAD", "SYSOP_RIGHTS", "FIREWALL_MELTDOWN", "BLACK_ICE_FIELD", "CYBERSPACE_PIRATE", "GLITCHMODE_OVERLOAD", "BYTECRASH_ANALYSIS", "MEMFRAG_ERROR", "VIRAL_PAYLOAD", "C0DEX_ARCHIVE", "SYNTHWAVE_BEACH", "RETROBYTE_DREAMS", "PIXELDUST_MEMORY", "WIREFRAME_GHOST", "N3ON_DREAMS", "DARKNET_GHOST", "HARDLINE_TO_HELL", "UPLINK_DENIED", "DOWNLINK_INTERCEPTED", "REPLICANT_TEARS",
                "D4T4SP1R4L", "N30N-SH4D0W", "CYB3R//SL4YER", "GL1TCH_M4TR1X", "404//N0T_F0UND", "5Y5-FAIL", "H4CK-TH3-W0RLD", "G1G4-BYT3", "V1RU5-L04D", "NULL-S3CT0R", "0V3RCL0CK-W4RN1NG", "F4T4L-5Y5-3RR0R", "R3B00T_PR0MPT", "M4TR1X-H4S-Y0U", "N3T-G0D", "D3CRYPT-K3Y", "3NCRYPT-TH3-D4T4", "CR45H-R3P0RT", "W1R3D-G0D", "P1X3L-P3RF3CT", "N01S3-FL00R", "3RR0R-L0G", "FR3Q-H0P", "J4CK_1N_F41L", "D3FR4G-DR1V3", "M3M0RY-L34K-D3T3CT3D", "B1N4RY-G0D", "C0D3X-L0CK3D", "SYNTH-DR34M", "DY5T0P14-L1V35", "FUTUR3-PR00F", "N3XU5-C0NN3CT10N", "N4N0-C0NSTRUCT", "41-G0D-C0MPL3X", "M0D-M4N14", "P4TCH-N0T-F0UND", "3X3-B0MB", "5Y532-C0RRUPT", "0V3RR1D3-C0D3", "R3Z-1N-P34C3", "5H4D0WRUN-L3G3ND", "1C3-C0LD", "D3CK-M45T3R", "N3TRUN-J0CK3Y", "CYB3RN3T1C-L1MB", "4UG-D3N13D", "CHR0M3-J0CK3Y", "GR1D-C0LL4PS3", "GH05T-W4LK3R", "Z3R0-C00L", "1MM0RT4L-S0UL", "1MPL4NT-SH0CK", "5PL1C3R-GH05T", "SYN4PS3-D3L4Y", "GL1TCHW4V3-MUS1C", "FR3Q5H1FT-K3Y", "D4T4D1V3-SU1T", "N30NC0R3-BL45T", "V1RTU4L-GH05T", "D3CRYPT-M45T3R", "5P3CTR3-GH05T", "PHR34K-C0D3", "T3RM1N4L-J0CK3Y", "PR0T0C0L-Z3R0", "5UBR0UT1N3-H4CK", "DD0S-BL4CK0UT", "R00TK1T-SC4N", "5Y50P-D3L3T3", "F1R3W4LL-BL4ST", "BL4CK_1C3_CURT41N", "CYB3RSP4C3-M4TR1X", "GL1TCHM0D3-UNL0CK3D", "BYT3CR4SH-C0D3", "M3MFR4G-W4RN1NG", "V1R4L-SYNDR0M3", "C0D3X-BR34K", "SYNTHW4V3-DR1V3", "R3TR0BYT3-CR4SH", "P1X3LDUST-DR34M", "W1R3FR4M3-C4G3", "N30N-L1GHT-N1GHTM4R3", "D4RKN3T-H4CK", "H4RDL1N3-C0NN3CT", "UPL1NK-S3CUR3", "D0WNL1NK-C0RRUPT3D", "R3PL1C4NT-BLU3S",
                "DATA//LEAK", "NEON::BURN", "CYBER_OVERLOAD", "GLITCH//LOGIC_BOMB", "404_DEAD_LINK", "SYS.FAIL", "HACK.THE.GIBSON", "BYTE.ME", "V1RUS.EXE", "NULL.SYS", "OVERCLOCK.FAIL", "FATAL.SYS.ERROR", "REBOOT.REQUIRED", "MATRIX.FAILURE", "N3T.WAR", "DECRYPT.LOOP", "ENCRYPT.KEY", "CRASH.REPORT.SEND", "WIRED.SYNAPSES", "PIXEL.BLEED", "NOISE.GENERATOR", "ERROR.LOG.FULL", "FREQ.SCANNER", "JACK.IN.FAIL", "DEFRAG.LOOP", "MEMORY.WIPE", "BINARY.VOID", "CODEX.ERROR", "SYNTH.ERROR", "DYSTOPIA.2099", "FUTURE.ERROR", "NEXUS.FAILURE", "NANO.DEATH", "AI.Singularity", "MOD.FAILURE", "PATCH.ERROR", "EXE.ERROR", "SYS32.WIPE.EXE", "OVERRIDE.DENIED", "REZ.ERROR", "SHADOWRUN.FAILURE", "ICE.FAILURE", "DECK.ERROR", "NETRUN.ABORT", "CYBERNETIC.FAILURE", "AUG.ERROR", "CHROME.ERROR", "GRID.ERROR", "GHOST.ERROR", "Z3R0.ERROR", "1MMORTAL.FAILURE", "IMPLANT.ERROR", "SPLICER.ERROR", "SYNAPSE.ERROR", "GLITCHWAVE.ERROR", "FREQSHIFT.FAILURE", "DATADIVE.ERROR", "NEONCORE.FAILURE", "V1RTUAL.ERROR", "D3CRYPT.ERROR", "SPECTRE.ERROR", "PHREAK.ERROR", "TERMINAL.ERROR", "PROTOCOL.ERROR", "SUBROUTINE.ERROR", "DDOS.ERROR", "ROOTKIT.ERROR", "SYSOP.ERROR", "FIREWALL.ERROR", "BLACK.ICE.ERROR", "CYBERSPACE.ERROR", "GLITCHMODE.ERROR", "BYTECRASH.ERROR", "MEMFRAG.FAILURE", "VIRAL.ERROR", "C0DEX.FAILURE", "SYNTHWAVE.ERROR", "RETROBYTE.FAILURE", "PIXELDUST.ERROR", "WIREFRAME.ERROR", "N3ON.ERROR", "DARKNET.ERROR", "HARDLINE.ERROR", "UPLINK.ERROR", "DOWNLINK.ERROR", "REPLICANT.ERROR",
                "D1G1T4L_S34RCH", "R3B1RTH_C0D3", "F34R_D0T_N3T", "V1RTU4L_PH0B14", "CYB3R_R3SURR3CT10N", "D4T4_GHOST", "S3RV3R_S0UL", "3RR0R_404_F34R_N0T_F0UND", "R3B00T_S3QU3NC3", "D1G1T4L_H3LLSC4P3", "N3W_FL3SH_V2.0", "F34R_1N_TH3_M4CH1N3", "S3A_0F_B1N4RY", "R3B0rN_H4CK3R", "F34RC0M_V1RUS", "D1G1T4L_ABYSS", "C0D3_CHRYS4L1S", "N3TW0RK_N1GHTM4R3", "D4T4STR34M_D3SC3NT", "R3C0MP1L3D_L1F3", "PH0B1A_PR0T0C0L", "0N11N3_0C34N", "R3B1RTH_ALG0R1THM", "D0WNL04D1NG_F34R", "D1G1T4L_DECAY", "R3G3N3R4T3_ID", "F34R_FR4GM3NT", "S3A_OF_N01S3", "R3B0rN_THR0UGH_W1R3S", "F34R_PACKET", "D1G1T4L_SH4D0W", "R3SURR3CT10N_B1T", "F34RD0TC0M_LOGON", "TH3_D1G1T4L_V01D", "R3B0rN_AS_D4T4", "T3RR0R_B1T3", "D33P_S3A_C0D1NG", "R3WR1TT3N_S0UL", "F34R_OF_THE_D4RK_W3B", "D1G1T4L_DR0WN1NG", "R3B0rN_1N_S1L1C0N", "F34R_THE_D1SC0NN3CT", "0C3AN_OF_L1GHT", "R3B0rN_GL1TCH", "F34R.EXE", "D1G1T4L_PANDEMONIUM", "R3B0rN_FROM_4SH", "F34R_IN_YOUR_CACHE", "D1G1T4L_T3MP3ST", "R3B0rN_CYB3RN3T1C", "F34R_THE_LAG", "GHOST_IN_THE_S3A", "R3B0rN_UNDELETED", "F34R_IS_A_V1RUS", "D1G1T4L_R3QU13M", "R3B0rN_V1RTU4LLY", "F34R_OF_A_BL4NK_SCR33N", "D1G1T4L_TSUN4M1", "S3C0ND_L1F3_C0D3", "F34R_IN_THE_FIREWALL", "S3A_OF_LOST_S0ULS", "R3B0rN_BY_TH3_BYT3", "F34R_D0T_GOV", "D1G1T4L_APOCALYPSE", "R3B0rN_IN_THE_GR1D", "F34R_LOOP", "D33P_D1G1T4L", "R3B0rN_UNPLUGG3D", "F34R_TH3_P1NG", "THE_D1G1T4L_MAELSTROM", "R3B0rN_IN_CHAOS", "F34R_BUFFER_OVERFLOW", "D1G1T4L_LIMB0", "R3B0rN_AFT3R_CR4SH", "F34R_PROCESS", "S3A_OF_CORRUPTION", "R3B0rN_FROM_NOISE", "F34R_OF_THE_UNKNOWN_USER", "D1G1T4L_ECH0", "R3B0rN_LOG1C_B0MB", "F34R_ACCESS_DENIED", "GHOST_IN_THE_D4T4", "R3B0rN_THROUGH_FIREWALL", "F34R_D0T_ORG", "D1G1T4L_PURG4T0RY", "R3B0rN_IN_A_SIMULATION", "F34R_OF_DELETION", "S3A_OF_SYNAPSES", "R3B0rN_FROM_A_BACKUP", "F34R_THE_4DM1N", "D1G1T4L_NEMESIS", "R3B0rN_AS_A_PHANTOM", "F34R_KERNEL_PANIC", "D1G1T4L_OCEANIC", "R3B0rN_BY_AI", "F34R_OF_THE_RED_SCREEN", "D4T4_M4ELSTR0M", "R3B0rN_IN_THE_NET", "F34R_OF_BEING_WATCHED", "D1G1T4L_LEVIATHAN", "R3B0rN_IN_CODE",
                "DEDICATED", "COMMITTED", "DEVOTED", "LOYAL", "AR", "ANNE FABER", "RIVER LYLE R."];
                return (gctx) => {
                    const strength = getStrength();
                    if (strength <= 0) return;
                    let text = `${keyPhrases[Math.floor(Math.random() * keyPhrases.length)]} - ${phrases[Math.floor(Math.random() * phrases.length)]}`;

                    gctx.save();
                    gctx.font = `${10 + Math.random() * 80 * strength}px ${['BlackOut 2AM', 'Courier New', 'Arial', 'Impact', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Comic Sans MS'][Math.floor(Math.random() * 9)]}, monospace`;
                    const hue = this.effectAlphas['Hue/Color Cycle'] * 360;
                    gctx.fillStyle = `hsla(${hue + (Math.random() - 0.5) * 60}, 100%, ${50 + (Math.random() - 0.5) * 20}%, ${0.8 * strength})`;
                    gctx.shadowColor = `hsla(${hue + 180}, 100%, 50%, 1)`;
                    gctx.shadowBlur = 5 + strength * 25;
                    gctx.globalCompositeOperation = 'lighter';
                    gctx.fillText(text, Math.random() * this.canvas.offsetWidth, Math.random() * this.canvas.offsetHeight);
                    gctx.restore();
                };
            },
            
            neonGradient: (getStrength) => {
                const colors = Array.from({length: 5}, (_, i) => ({ hue: (Math.random() * 360 + i * 72) % 360, stop: i / 4 }));
                return (gctx) => {
                    const strength = getStrength();
                    if (strength <= 0) return;
                    const x = this.canvas.offsetWidth * (0.5 + (Math.random() - 0.5) * this.masterBeat * 0.5);
                    const y = this.canvas.offsetHeight * (0.5 + (Math.random() - 0.5) * this.masterBeat * 0.5);
                    const radius = (this.canvas.offsetWidth / 4) + (this.masterBeat * (this.canvas.offsetWidth / 3)) * strength;
                    const gradient = gctx.createRadialGradient(x, y, 0, x, y, radius);
                    colors.forEach(c => gradient.addColorStop(c.stop, `hsla(${(c.hue + this.masterBeat * 40) % 360}, 100%, 70%, ${0.6 * strength})`));
                    gctx.save();
                    gctx.globalCompositeOperation = 'screen';
                    gctx.fillStyle = gradient;
                    gctx.fillRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
                    gctx.restore();
                };
            },

            scanlines: (getStrength) => {
                return (gctx) => {
                    const strength = getStrength();
                    if (strength <= 0) return;
                    const yOffset = this.customTime * 0.05 * strength;
                    const lineHeight = 1 + Math.floor(strength * 5);
                    gctx.save();
                    gctx.globalAlpha = 0.75 * strength;
                    gctx.fillStyle = `hsla(0, 0%, 10%, 0.8)`;
                    for (let y = yOffset % (lineHeight * 2); y < this.canvas.offsetHeight; y += (lineHeight * 2)) {
                        gctx.fillRect(0, y, this.canvas.offsetWidth, lineHeight);
                    }
                    gctx.restore();
                };
            },

            vhs: (getStrength) => {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                return (gctx) => {
                    const strength = getStrength();
                    if (strength <= 0) return;
                    const w = this.canvas.offsetWidth;
                    const h = this.canvas.offsetHeight;
                     if (tempCanvas.width !== w || tempCanvas.height !== h) {
                        tempCanvas.width = w; tempCanvas.height = h;
                    }
                    const dpr = window.devicePixelRatio || 1;
                    tempCtx.clearRect(0,0,w,h);
                    tempCtx.drawImage(this.canvas, 0, 0, w*dpr, h*dpr, 0,0,w,h);
                    gctx.clearRect(0, 0, w, h);
                    const wobbleAmount = strength * 15;
                    const rollSpeed = this.customTime / 500;
                    for (let y = 0; y < h; y += 5) {
                        const wobbleOffset = Math.sin(y / 30 + rollSpeed) * wobbleAmount;
                        try { gctx.drawImage(tempCanvas, 0, y, w, 5, wobbleOffset, y, w, 5); } catch (e) {}
                    }
                };
            },

            vhsGlitch: (getStrength) => {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                return (gctx) => {
                    const strength = getStrength();
                    if(strength <= 0) return;
                    const w = this.canvas.offsetWidth;
                    const h = this.canvas.offsetHeight;
                    if(tempCanvas.width !== w || tempCanvas.height !== h){
                        tempCanvas.width = w; tempCanvas.height = h;
                    }
                    const dpr = window.devicePixelRatio || 1;
                    tempCtx.clearRect(0,0,w,h);
                    tempCtx.drawImage(this.canvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
                    
                    const sliceHeight = 4 + Math.floor(Math.random() * 3);
                    for (let y = 0; y < h; y += sliceHeight) {
                        const jitter = Math.sin(y / 18 + this.customTime / 120) * 8 * strength + (Math.random() - 0.5) * 4 * strength;
                        gctx.drawImage(tempCanvas, 0, y, w, sliceHeight, jitter, y, w, sliceHeight);
                    }
                };
            },
            
            brightFlash: (getStrength) => {
                return (gctx) => {
                    if (getStrength() > 0 && Math.random() > 0.5) {
                        gctx.save();
                        gctx.globalAlpha = (0.1 + Math.random() * 0.25) * getStrength();
                        gctx.fillStyle = `hsl(${Math.random() * 360}, 90%, 90%)`;
                        gctx.fillRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
                        gctx.restore();
                    }
                };
            },
            
            hslRainbow: (getStrength) => (gctx) => {
                const strength = getStrength();
                if (strength > 0) {
                    gctx.save();
                    gctx.globalCompositeOperation = 'difference';
                    gctx.globalAlpha = strength * 0.7;
                    gctx.fillStyle = `hsl(${(this.customTime * 0.09) % 360}, 100%, 50%)`;
                    gctx.fillRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
                    gctx.restore();
                }
            },

            strobe: (getStrength) => (gctx) => {
                const strength = getStrength();
                if (strength > 0) {
                    gctx.save();
                    gctx.globalAlpha = Math.random() < (strength * 0.5 * this.timeScale) ? strength * 0.5 : 0;
                    gctx.fillStyle = 'white';
                    gctx.fillRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
                    gctx.restore();
                }
            },

            geminiBomb: (getStrength) => {
                const shapes = Array.from({length: 40}, () => ({
                    x: Math.random() * this.canvas.offsetWidth, y: Math.random() * this.canvas.offsetHeight,
                    baseSize: 5 + Math.random() * 15, shapeType: ['rect', 'circle', 'triangle'][Math.floor(Math.random()*3)],
                    angle: Math.random() * Math.PI * 2, speed: (1 + Math.random() * 8), hue: Math.random() * 360,
                }));
                return (gctx) => {
                    const strength = getStrength();
                    if (strength <= 0) return;
                    gctx.save();
                    gctx.globalCompositeOperation = 'lighter';
                    shapes.forEach(s => {
                        s.x += Math.cos(s.angle) * s.speed * strength * this.timeScale;
                        s.y += Math.sin(s.angle) * s.speed * strength * this.timeScale;
                        if (s.x < 0 || s.x > this.canvas.offsetWidth || s.y < 0 || s.y > this.canvas.offsetHeight) {
                            s.x = this.canvas.offsetWidth/2; s.y = this.canvas.offsetHeight/2;
                        }
                        gctx.fillStyle = `hsla(${s.hue}, 100%, 70%, ${0.75 * strength})`;
                        gctx.beginPath();
                        const size = (s.baseSize + this.masterBeat * 10) * strength;
                        if(s.shapeType === 'rect') gctx.rect(s.x - size/2, s.y - size/2, size, size);
                        else gctx.arc(s.x, s.y, size/2, 0, Math.PI * 2);
                        gctx.fill();
                    });
                    gctx.restore();
                };
            }
        }
    }

    window.glitchController = new GlitchController('glitchCanvas');
});
