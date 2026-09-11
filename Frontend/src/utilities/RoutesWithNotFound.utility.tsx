import { Route, Routes, useNavigate } from "react-router-dom"
import { NotFoundProps } from "@/interfaces"

function RoutesWithNotFound({ children }: NotFoundProps) {
    const navigate  = useNavigate()
    return (
        <Routes>

            {children}
            <Route path="*" element={
                <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
                    <p className="text-sm font-semibold text-teal-700">Error 404</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                        Esta página no existe
                    </h1>
                    <p className="max-w-sm text-slate-500">
                        Revisá la dirección o volvé al inicio.
                    </p>
                    <button
                        className="mt-2 cursor-pointer rounded-md bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600"
                        onClick={() => navigate('/')}
                    >
                        Volver al inicio
                    </button>
                </div>
                } />

        </Routes>
    )

}
export default RoutesWithNotFound
