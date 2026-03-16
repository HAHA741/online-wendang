"use client";
import { Workbook, WorkbookInstance } from "@fortune-sheet/react";
import { Sheet, Op, Selection, colors } from "@fortune-sheet/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import "@fortune-sheet/react/dist/index.css";
import { useParams, useSearchParams } from "next/navigation";
import { useRequest } from "ahooks";
import { createWorkbook, getWorkbookList } from "../../api";
import { Spin } from "antd";
import dayjs from "dayjs";
// import { Meta, StoryFn } from "@storybook/react";

// export default {
//   component: Workbook,
// } as Meta<typeof Workbook>;

function Home() {
  const { data: workbookList, run } = useRequest(getWorkbookList);
  const { data: initData, runAsync: createAsync } = useRequest(createWorkbook, {
    manual: true,
    onSuccess(data, params) {},
  });

  const searchParams = useSearchParams();
  const workbookId = searchParams.get("workbookId");

  const [data, setData] = useState<Sheet[]>();
  const [error, setError] = useState(false);
  const wsRef = useRef<WebSocket>(null);
  const workbookRef = useRef<WorkbookInstance>(null);
  const lastSelection = useRef<any>(null);
  const { username, userId } = useMemo(() => {
    const _userId = uuidv4();
    return { username: `User-${_userId.slice(0, 3)}`, userId: _userId };
  }, []);

  const hashCode = (str: string) => {
    let hash = 0;
    let i;
    let chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i += 1) {
      chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  };
  const init = async () => {
    // 动态获取当前访问的域名，如果是生产环境，它会是服务器 IP 或域名
    const host = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const httpProtocol = window.location.protocol;
    let _workbookId = workbookId;

    if (!workbookId) {
      const date = new Date();
      
      let res = await createAsync(`新建文档${dayjs(date).format("YYYY-MM-DD HH:mm:ss")}`);
      _workbookId = res?.workbookId;
    }
    // 拼接成正确的地址，端口依然是 8081
    const socket = new WebSocket(
      `${protocol}//${host}:8081/ws?workbookId=${_workbookId}`,
    );
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ req: "getData" }));
    };
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.req === "getData") {
        setData(msg.data.map((d: any) => ({ id: d._id, ...d })));
      } else if (msg.req === "op") {
        workbookRef.current?.applyOp(msg.data);
      } else if (msg.req === "addPresences") {
        workbookRef.current?.addPresences(msg.data);
      } else if (msg.req === "removePresences") {
        workbookRef.current?.removePresences(msg.data);
      }
    };
    socket.onerror = () => {
      setError(true);
    };
  };

  useEffect(() => {
    init();
  }, [workbookId]);

  const onOp = useCallback((op: Op[]) => {
    const socket = wsRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ req: "op", data: op }));
  }, []);

  const onChange = useCallback((d: Sheet[]) => {
    setData(d);
  }, []);

  const afterSelectionChange = useCallback(
    (sheetId: string, selection: Selection) => {
      const socket = wsRef.current;
      if (!socket) return;
      const s = {
        r: selection.row[0],
        c: selection.column[0],
      };
      if (
        lastSelection.current?.r === s.r &&
        lastSelection.current?.c === s.c
      ) {
        return;
      }
      lastSelection.current = s;
      socket.send(
        JSON.stringify({
          req: "addPresences",
          data: [
            {
              sheetId,
              username,
              userId,
              color: colors[Math.abs(hashCode(userId)) % colors.length],
              selection: s,
            },
          ],
        }),
      );
    },
    [userId, username],
  );

  if (!data)
    return (
      <SpinWrapper>
        <Spin description="文档初始化中..." size="large"></Spin>
      </SpinWrapper>
    );
  return (
    <Wrapper>
      <Workbook
        ref={workbookRef}
        data={data}
        onChange={onChange}
        onOp={onOp}
        hooks={{
          afterSelectionChange,
        }}
      />
    </Wrapper>
  );
}

export default Home.bind({});

export const Wrapper = styled.div`
  width: 100%;
  height: 100vh;
`;

export const SpinWrapper = styled.div`
  background: #fff;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;
