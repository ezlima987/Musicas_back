import "dotenv/config"
import cors from "cors"
import express from "express"
import mysql from "mysql2/promise"

const app = express()
const port = Number(process.env.PORT) || 3000
const tableName = process.env.TABELA_MUSICAS || "musicas_enzo_21bti"

if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    throw new Error("TABELA_MUSICAS deve conter apenas letras, números e underscores.")
}

const requiredDatabaseSettings = [
    "HOST_BANCO",
    "USUARIO_BANCO",
    "SENHA_BANCO",
    "NOME_BANCO"
]
const missingDatabaseSettings = requiredDatabaseSettings.filter((key) => !process.env[key])

if (missingDatabaseSettings.length > 0) {
    throw new Error(`Configure no .env: ${missingDatabaseSettings.join(", ")}`)
}

const sql = mysql.createPool({
    host: process.env.HOST_BANCO,
    port: Number(process.env.PORTA_BANCO) || 3306,
    user: process.env.USUARIO_BANCO,
    password: process.env.SENHA_BANCO,
    database: process.env.NOME_BANCO,
    waitForConnections: true,
    connectionLimit: 10
})

app.use(cors())
app.use(express.json())

function isValidMusic(music) {
    return (
        music &&
        typeof music.titulo === "string" &&
        music.titulo.trim() !== "" &&
        typeof music.artista === "string" &&
        music.artista.trim() !== "" &&
        typeof music.genero === "string" &&
        music.genero.trim() !== "" &&
        Number.isInteger(music.ano) &&
        Number.isInteger(music.duracao) &&
        music.ano > 0 &&
        music.duracao > 0
    )
}

function parseId(value) {
    const id = Number(value)
    return Number.isInteger(id) && id > 0 ? id : null
}

function handleDatabaseError(error, response) {
    console.error(error)
    response.status(500).json({ mensagem: "Erro ao acessar o banco de dados." })
}

app.get("/", async (_request, response) => {
    try {
        const [musicas] = await sql.query(`SELECT * FROM \`${tableName}\``)
        response.json(musicas)
    } catch (error) {
        handleDatabaseError(error, response)
    }
})

app.post("/cadastrar", async (request, response) => {
    const { titulo, artista, genero, ano, duracao } = request.body

    if (!isValidMusic({ titulo, artista, genero, ano, duracao })) {
        return response.status(400).json({ mensagem: "Informe todos os dados corretamente." })
    }

    try {
        await sql.query(
            `INSERT INTO \`${tableName}\` (titulo, artista, genero, ano, duracao) VALUES (?, ?, ?, ?, ?)`,
            [titulo.trim(), artista.trim(), genero.trim(), ano, duracao]
        )
        response.status(201).json({ mensagem: "Música cadastrada com sucesso!" })
    } catch (error) {
        handleDatabaseError(error, response)
    }
})

app.delete("/apagar/:id", async (request, response) => {
    const id = parseId(request.params.id)

    if (!id) {
        return response.status(400).json({ mensagem: "ID inválido." })
    }

    try {
        const [result] = await sql.query(
            `DELETE FROM \`${tableName}\` WHERE id = ?`,
            [id]
        )
        if (result.affectedRows === 0) {
            return response.status(404).json({ mensagem: "Música não encontrada." })
        }
        response.json({ mensagem: "Música apagada com sucesso!" })
    } catch (error) {
        handleDatabaseError(error, response)
    }
})

app.get("/musica/:id", async (request, response) => {
    const id = parseId(request.params.id)

    if (!id) {
        return response.status(400).json({ mensagem: "ID inválido." })
    }

    try {
        const [musicas] = await sql.query(
            `SELECT * FROM \`${tableName}\` WHERE id = ?`,
            [id]
        )
        if (musicas.length === 0) {
            return response.status(404).json({ mensagem: "Música não encontrada." })
        }
        response.json(musicas[0])
    } catch (error) {
        handleDatabaseError(error, response)
    }
})

app.put("/editar/:id", async (request, response) => {
    const id = parseId(request.params.id)
    const { titulo, artista, genero, ano, duracao } = request.body

    if (!id) {
        return response.status(400).json({ mensagem: "ID inválido." })
    }
    if (!isValidMusic({ titulo, artista, genero, ano, duracao })) {
        return response.status(400).json({ mensagem: "Informe todos os dados corretamente." })
    }

    try {
        const [musicas] = await sql.query(
            `SELECT id FROM \`${tableName}\` WHERE id = ?`,
            [id]
        )
        if (musicas.length === 0) {
            return response.status(404).json({ mensagem: "Música não encontrada." })
        }

        await sql.query(
            `UPDATE \`${tableName}\` SET titulo = ?, artista = ?, genero = ?, ano = ?, duracao = ? WHERE id = ?`,
            [titulo.trim(), artista.trim(), genero.trim(), ano, duracao, id]
        )
        response.json({ mensagem: "Música alterada com sucesso!" })
    } catch (error) {
        handleDatabaseError(error, response)
    }
})

if (process.env.VERCEL !== "1") {
    app.listen(port, () => {
        console.log(`Servidor online na porta ${port}`)
    })
}

export default app
