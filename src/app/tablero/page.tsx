import { Suspense } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import Tablero from "@/components/Tablero";
import { UUID_DEMO } from "@/lib/tablero";

type SearchParams = PageProps<"/tablero">["searchParams"];

// Hasta el Sprint 2 el UUID se pasa por query param: /tablero?id=<uuid>
async function TableroDelJugador({ searchParams }: { searchParams: SearchParams }) {
    const { id } = await searchParams;
    const uuid = (Array.isArray(id) ? id[0] : id) || UUID_DEMO;

    return <Tablero uuid={uuid} />;
}

export default function TableroPage({ searchParams }: PageProps<"/tablero">) {
    return (
        <div className={styles.page}>
            <main className={styles.poster}>
                <Image src="/Bingo Halloween.jpg" alt="Halloween Bingo"
                    width={1414}
                    height={2000}
                    sizes="(max-width: 600px) 100vw, 600px"
                    preload
                    className={styles.imagen}
                />
                <div className={styles.grilla}>
                    <Suspense>
                        <TableroDelJugador searchParams={searchParams} />
                    </Suspense>
                </div>
            </main>
        </div>
    )
}
