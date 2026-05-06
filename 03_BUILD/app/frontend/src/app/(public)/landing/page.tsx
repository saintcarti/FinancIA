/**
 * LANDING público financia-chile.cl
 * Server component (sin auth requerida).
 */
export const metadata = {
  title: 'FinancIA Chile — Tu derecho financiero, explicado simple',
  description:
    'Agente de IA que responde tus dudas sobre finanzas, regulación y derechos del consumidor en Chile. Por Instagram DM y WhatsApp. Gratis. Citando CMF.'
};

const examples = [
  {
    user: '"Me cobraron $4.500 en mi cartola que dice Comisión Mantención. ¿Qué es?"',
    bot: 'Es el cargo mensual por mantener tu cuenta. La institución debe haberlo informado expresamente al firmar (Art. 17 B Ley 19.496). Si nunca lo viste, puedes pedir reembolso.'
  },
  {
    user: '"Me llamó alguien del Banco Pacífico Central ofreciendo crédito. ¿Es real?"',
    bot: '🚨 No encuentro esa entidad en la lista oficial CMF. Eso significa que NO es un banco autorizado en Chile. Bloquea el número. Aquí cómo denunciar [guía 4 pasos]'
  },
  {
    user: '"¿Qué pasa si no pago la cuota de mi tarjeta?"',
    bot: 'A los 30 días de mora pueden reportarte a DICOM. Tienes derecho a una hoja de información comercial gratis al año. Conviene repactar antes de los 30 días.'
  }
];

const faq = [
  {
    q: '¿Es gratis de verdad?',
    a: 'Sí. Para siempre, mientras logremos cubrir el costo (~$0.02 USD por conversación). Sin pauta, sin venta de datos, sin upsell.'
  },
  {
    q: '¿Por qué no es una app?',
    a: 'Porque ya tienes Instagram y WhatsApp instalados. Pedirte que descargues una app más es fricción que no aporta valor.'
  },
  {
    q: '¿Quién está detrás?',
    a: 'QUANT24, una agencia chilena de IA aplicada.'
  },
  {
    q: '¿Qué hacen con mis mensajes?',
    a: 'Los usamos solo para mejorar el servicio (anonimizados) y los borramos a los 90 días. Nunca los compartimos ni vendemos. Ley 19.628 cumplida.'
  },
  {
    q: '¿Y si me das una respuesta mala?',
    a: 'Puedes marcar 👎 o pedir hablar con un humano. Llegamos a tu DM en menos de 4 horas hábiles.'
  },
  {
    q: '¿Qué NO me van a responder?',
    a: 'Recomendaciones de inversión, comparaciones de productos específicos, asesoría personalizada. Te derivamos a un asesor certificado.'
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      {/* HERO */}
      <header className="container mx-auto px-6 pt-10 flex items-center justify-between">
        <img src="/logo.svg" alt="FinancIA Chile" width={200} height={60} />
        <nav className="hidden sm:flex gap-6 text-sm text-slate-700">
          <a href="#como" className="hover:text-brand-600">Cómo funciona</a>
          <a href="#ejemplos" className="hover:text-brand-600">Ejemplos</a>
          <a href="#faq" className="hover:text-brand-600">FAQ</a>
        </nav>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-20 text-center">
        <span className="inline-block bg-accent-500/10 text-accent-500 px-3 py-1 rounded-full text-xs font-medium mb-6">
          Construido para Chile Fintech Forum 2026
        </span>
        <h1 className="text-5xl md:text-6xl font-bold text-brand-900 leading-tight">
          Tu derecho financiero, <span className="text-accent-500">explicado simple</span>.
        </h1>
        <p className="text-xl text-slate-600 mt-6 max-w-2xl mx-auto">
          Pregunta por Instagram o WhatsApp. Te responde un agente con datos en vivo de la CMF.
          <br />
          <strong>Gratis. Sin app. Sin registro. En menos de 8 segundos.</strong>
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://ig.me/m/financia.chile"
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-4 rounded-xl text-lg shadow-lg shadow-brand-600/30"
          >
            Pruébalo en Instagram →
          </a>
          <a
            href="https://wa.me/56912345678"
            className="bg-accent-500 hover:bg-accent-500/90 text-white font-semibold px-8 py-4 rounded-xl text-lg shadow-lg shadow-accent-500/30"
          >
            O por WhatsApp →
          </a>
        </div>
        <p className="text-xs text-slate-500 mt-6">
          No damos asesoría financiera. Solo te explicamos lo que ya está publicado pero nadie lee.
        </p>
      </section>

      {/* PROBLEMA */}
      <section className="bg-brand-900 text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold">El 79% de los chilenos no entiende sus derechos financieros.</h2>
          <p className="mt-4 text-brand-100 max-w-2xl mx-auto text-lg">
            No es porque no esté escrito. Está escrito en CMF, en SVS, en Ley del Consumidor.
            <br />
            <strong>El problema es que está escrito como ley, no como respuesta a tu pregunta.</strong>
          </p>
          <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto text-left">
            <Card icon="🏦" title='"¿Mi tasa CAE está bien?"' text="La respuesta está en una circular CMF de 47 páginas." />
            <Card icon="📞" title='"¿Este banco que me llama es real?"' text="La verificación toma 6 clicks y 4 minutos." />
            <Card icon="📑" title='"¿Cómo reclamo a CMF?"' text="El procedimiento oficial son 11 pasos en distintos sitios." />
          </div>
        </div>
      </section>

      {/* CÓMO */}
      <section id="como" className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-brand-900 text-center mb-12">En 3 pasos</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Step n={1} title="Mándanos DM" text="En Instagram (@financia.chile) o WhatsApp." />
          <Step n={2} title="Pregunta lo que sea de tu plata" text='"¿Qué es la UF?", "¿Por qué me cobraron este seguro?", "¿Cómo verifico una tasa?"' />
          <Step n={3} title="Recibe respuesta clara con fuente CMF" text="En menos de 8 segundos. Citamos la fuente oficial en cada respuesta." />
        </div>
      </section>

      {/* EJEMPLOS */}
      <section id="ejemplos" className="bg-slate-50 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-brand-900 text-center mb-12">Ejemplos reales</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {examples.map((ex, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-sm text-slate-500 mb-2">🟢 Pregunta del usuario</div>
                <p className="text-slate-700 italic mb-4">{ex.user}</p>
                <div className="text-sm text-slate-500 mb-2">🤖 Respuesta del bot</div>
                <p className="text-slate-900">{ex.bot}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <Trust icon="🛡️" title="Datos oficiales CMF" text="Cada respuesta cita la fuente regulatoria. Sin opinión. Sin sesgo." />
          <Trust icon="🔒" title="Privacidad real" text="No pedimos RUT, contraseñas ni números de cuenta. Mensajes borrados a los 90 días." />
          <Trust icon="⚖️" title="Educación, no asesoría" text="No recomendamos productos. No vendemos nada. Cada respuesta lo deja claro." />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-20">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-4xl font-bold text-brand-900 text-center mb-12">FAQ</h2>
          <div className="space-y-6">
            {faq.map((f, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="font-semibold text-brand-900 mb-2">{f.q}</div>
                <div className="text-slate-700">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-900 text-brand-100 py-12">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <p className="text-sm">
            FinancIA Chile entrega información educativa basada en fuentes públicas de la CMF, SERNAC y leyes chilenas.
            NO constituye asesoría financiera personalizada ni recomendación de inversión. Para decisiones específicas
            consulta a un asesor financiero certificado.
          </p>
          <p className="text-xs mt-6 text-brand-100/70">
            Construido por <a href="https://quant24.cl" className="underline">QUANT24</a> · Chile · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

function Card({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="bg-brand-700/50 backdrop-blur rounded-2xl p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="font-semibold mb-2">{title}</div>
      <div className="text-brand-100 text-sm">{text}</div>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 mx-auto bg-brand-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
        {n}
      </div>
      <div className="text-xl font-semibold text-brand-900 mb-2">{title}</div>
      <div className="text-slate-600">{text}</div>
    </div>
  );
}

function Trust({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div>
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-xl font-semibold text-brand-900 mb-2">{title}</div>
      <div className="text-slate-600">{text}</div>
    </div>
  );
}
