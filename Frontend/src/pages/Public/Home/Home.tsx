import { Link } from 'react-router-dom';
import { catalogs } from '@/catalogs';

/** Landing pública — punto de entrada a los distintos diseños de catálogo
 * registrados en src/catalogs/catalogs.config.ts (ver ese archivo para
 * agregar uno nuevo). Montada en '/' (ver App.tsx); el catálogo clásico,
 * que antes vivía acá, se movió a '/catalog' sin tocar su código — ver
 * Frontend/CLAUDE.md.
 *
 * No pide datos al backend: es pura navegación, arma una card por cada
 * entrada del registro sin conocer los diseños en particular. Cada
 * catálogo se presenta como una lámina completa (degradé propio +
 * nombre superpuesto) en vez de la card "imagen arriba / texto abajo"
 * más literal que tenía antes — pensado para que se lea como una
 * vidriera de diseños, no como un listado de opciones de configuración. */
function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-lg font-extrabold text-white tracking-tight">
            Tienda Básica
          </span>
          <Link
            to="/contacto"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Contacto
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        {/* sin el número de diseños en el título a propósito — con 2 decía
            "tres" antes de que existiera Catalog3, y volvió a pasar con
            Catalog4. Así no vuelve a quedar desactualizado la próxima vez
            que se agregue uno al registro. */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight max-w-lg">
          Un catálogo, muchas formas de mirarlo
        </h1>
        <p className="mt-3 text-slate-600 max-w-md">
          Los mismos productos, categorías y precios — cada diseño de abajo es solo una manera
          distinta de mostrarlos. Elegí uno para navegar la tienda.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogs.map((catalog) => (
            <Link
              key={catalog.id}
              to={`/${catalog.path}`}
              className="group flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600"
            >
              {/* la lámina entera es el degradé propio de cada diseño (ver
                  catalogs.config.ts) — no una captura real de la página,
                  así no se desactualiza si el diseño cambia. El nombre va
                  superpuesto con un scrim oscuro abajo, en vez de vivir
                  como texto aparte debajo de una franja de color chica. */}
              <div className={`relative h-40 ${catalog.previewClassName}`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                <h2 className="absolute bottom-3 left-4 right-4 text-xl font-bold text-white tracking-tight">
                  {catalog.name}
                </h2>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <p className="text-sm text-slate-600 flex-1">{catalog.description}</p>
                <span className="text-sm font-semibold text-teal-700 group-hover:underline">
                  Ver catálogo
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
