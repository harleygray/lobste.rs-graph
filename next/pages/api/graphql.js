import {gql, ApolloServer} from "apollo-server-micro"
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import neo4j from "neo4j-driver"
import { Neo4jGraphQL } from "@neo4j/graphql"
import 'ts-tiny-invariant'

const typeDefs = gql`
    type Article @exclude(operations: [CREATE, UPDATE, DELETE]) {
        short_id: ID
        url: String
        score: Int
        title: String
        comments: String
        created: DateTime
        user: User @relationship(type: "SUBMITTED", direction: IN)
        tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    }

    type User @exclude(operations: [CREATE, UPDATE, DELETE]) {
        username: String
        created: DateTime
        karma: Int
        about: String
        avatar: String
        invited_by: [User!]! @relationship(type: "INVITED_BY", direction: OUT)
        articles: [Article!]! @relationship(type: "SUBMITTED", direction: OUT)
        invited: [User!]! @relationship(type: "INVITED_BY", direction: IN)
    }

    type Tag @exclude(operations: [CREATE, UPDATE, DELETE]) {
        name: String
        articles: [Article!]! @relationship(type: "HAS_TAG", direction: IN)
    }
`;

const driver = neo4j.driver(
    process.env.NEO4J_URI, 
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const neoSchema = new Neo4jGraphQL({typeDefs, driver});





export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "https://studio.apollographql.com");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === "OPTIONS") {
        res.end();
        return false;
    }
    const apolloServer = new ApolloServer({
        schema: await neoSchema.getSchema(),
        playground: true,
        introspection: true,
        plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
    });

    await apolloServer.start();

    await apolloServer.createHandler({
        path: "/api/graphql"
    })(req, res);
}

export const config = {
    api: {
        bodyParser: false,
    },
};