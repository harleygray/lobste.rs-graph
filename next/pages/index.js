// Dynamic import disabled Server Side Rendering, because React Force Graph uses GPU acceleration to render
import dynamic from "next/dynamic";
import { useQuery, gql, useLazyQuery } from "@apollo/client";
import { useState } from "react";
import _ from "lodash";

const mostRecentQuery = gql`
  {
    articles(options: { limit: 30, sort: { created: DESC } }) {
      __typename
      short_id
      title
      created
      url
      tags {
        __typename
        name
      }
      user {
        __typename
        username
        avatar
      }
    }
  }
`;

const moreArticlesQuery = gql`
  query articlesByTag($tag: String) {
    articles(
      where: { tags: { name: $tag } }
      options: { limit: 10, sort: { created: DESC } }
    ) {
      __typename
      short_id
      title
      created
      url
      tags {
        __typename
        name
      }
      user {
        __typename
        username
        avatar
      }
    }
  }
`;

const NoSSRForceGraph = dynamic(() => import("../lib/NoSSRForceGraph"), {
  ssr: false,
});

const formatData = (data) => {
  const nodes = [];
  const links = [];

  if (!data.articles) {
    return { nodes, links };
  }

  data.articles.forEach((a) => {
    nodes.push({
      id: a.short_id,
      url: a.url,
      __typename: a.__typename,
      title: a.title,
    });

    nodes.push({
      id: a.user.username,
      avatar: a.user.avatar,
      __typename: a.user.__typename,
    });

    links.push({
      source: a.user.username,
      target: a.short_id,
    });

    a.tags.forEach((t) => {
      nodes.push({
        id: t.name,
        __typename: t.__typename,
      });

      links.push({
        source: a.short_id,
        target: t.name,
      });
    });
  });

  return {
    nodes: _.uniqBy(nodes, "id"),
    links,
  };
};

export default function Home() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const { data } = useQuery(mostRecentQuery, {
    onCompleted: (data) => setGraphData(formatData(data)),
  });
  const [loadMoreArticles, { called, loading, data: newData }] = useLazyQuery(
    moreArticlesQuery,
    {
      onCompleted: (data) => {
        const newSubGraph = formatData(data);
        setGraphData({
          nodes: _.uniqBy([...graphData.nodes, ...newSubGraph.nodes], "id"),
          links: [...graphData.links, ...newSubGraph.links],
        });
      },
    }
  );
  return (
    <NoSSRForceGraph
      graphData={graphData}
      nodeLabel={"id"}
      nodeAutoColorBy={"__typename"}
      onNodeClick={(node, event) => {
        console.log(node);
        if (node.__typename === "Tag") {
          loadMoreArticles({ variables: { tag: node.id } });
        } else if (node.__typename === "Article") {
          window.open(node.url, "_blank");
        }
      }}
      nodeCanvasObject={(node, ctx, globalScale) => {
        if (node.__typename === "Tag" || node.__typename === "Article") {
          const label = node.title || node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );
          ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = node.color;
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions;
        } else if (node.__typename === "User") {
          const size = 12;
          const img = new Image();
          img.src = node.avatar;
          ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
        }
      }}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.fillStyle = color;
        const bckgDimensions = node.__bckgDimensions;
        bckgDimensions &&
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
      }}
    />
  );
}
