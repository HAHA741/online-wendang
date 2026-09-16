"use client";
import { Workbook, WorkbookInstance } from "@fortune-sheet/react";
import { Sheet, Op, Selection, colors } from "@fortune-sheet/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import "@fortune-sheet/react/dist/index.css";
import { useSearchParams } from "next/navigation";
import { useRequest } from "ahooks";
import {
  createWorkbook,
  replaceWorkbookSheets,
} from "../../api";
import { message, Spin } from "antd";
import dayjs from "dayjs";
import {
  FortuneExcelHelper,
  importToolBarItem,
  exportToolBarItem,
} from "@corbe30/fortune-excel";
import { createFortuneHelperRef } from "./fortuneHelperRef";
import {
  calculateWheelScrollTop,
  shouldHandleVerticalWheel,
} from "./wheelScroll";
// import { Meta, StoryFn } from "@storybook/react";

// export default {
//   component: Workbook,
// } as Meta<typeof Workbook>;

function Home() {
  const { runAsync: createAsync } = useRequest(createWorkbook, {
    manual: true,
  });

  const searchParams = useSearchParams();
  const workbookId = searchParams.get("workbookId");

  const [key, setKey] = useState<number>(0);

  const [data, setData] = useState<Sheet[]>();
  const wsRef = useRef<WebSocket>(null);
  const workbookRef = useRef<WorkbookInstance>(null);
  const workbookHostRef = useRef<HTMLDivElement>(null);
  const activeWorkbookIdRef = useRef<string | null>(workbookId);
  const importSavingRef = useRef(false);
  const importedSheetsToSizeRef = useRef<Sheet[] | null>(null);
  const lastSelection = useRef<{ r: number; c: number } | null>(null);
  const [importSaving, setImportSaving] = useState(false);
  const excelHelperRef = useMemo(
    () => createFortuneHelperRef(() => workbookRef.current),
    [],
  );
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
  const init = useCallback(async () => {
    // 动态获取当前访问的域名，如果是生产环境，它会是服务器 IP 或域名
    const host = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let _workbookId = workbookId;

    if (!workbookId) {
      const date = new Date();
      const res = await createAsync(
        `新建文档${dayjs(date).format("YYYY-MM-DD HH:mm:ss")}`,
      );
      _workbookId = res?.workbookId;
    }
    if (!_workbookId) {
      message.error("无法确定当前工作簿，初始化失败");
      return;
    }
    activeWorkbookIdRef.current = _workbookId;
    // 拼接成正确的地址，端口依然是 8081
    const socket = new WebSocket(
      `${protocol}//${host}:8081/ws?workbookId=${_workbookId}`,
    );
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ req: "getData" }));
    };
    socket.onmessage = (e) => {
      console.log("收到消息",e)
      const msg = JSON.parse(e.data);
      console.log(msg,'msg')
      if (msg.req === "getData") {
        setData(msg.data);
      } else if (msg.req === "replaceData") {
        importedSheetsToSizeRef.current = msg.data;
        setData(msg.data);
        setKey((current) => current + 1);
      } else if (msg.req === "op") {
        workbookRef.current?.applyOp(msg.data);
      } else if (msg.req === "addPresences") {
        workbookRef.current?.addPresences(msg.data);
      } else if (msg.req === "removePresences") {
        workbookRef.current?.removePresences(msg.data);
      } else if (msg.req === "error") {
        message.error(msg.message || "工作簿保存失败");
      }
    };
    socket.onerror = () => {
      message.error("工作簿实时连接失败");
    };
  }, [createAsync, workbookId]);

  useEffect(() => {
    void init();
    return () => {
      wsRef.current?.close();
    };
  }, [init]);

  const onOp = useCallback((op: Op[]) => {
    const socket = wsRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ req: "op", data: op }));
  }, []);

  const onChange = useCallback((d: Sheet[]) => {
    setData(d);
  }, []);

  const handleImportedSheets = useCallback((sheets: Sheet[]) => {
    const activeWorkbookId = activeWorkbookIdRef.current;
    if (!activeWorkbookId) {
      message.error("当前工作簿尚未初始化，无法保存导入数据");
      return;
    }
    if (importSavingRef.current) {
      message.warning("正在保存上一次导入，请稍候");
      return;
    }

    importSavingRef.current = true;
    setImportSaving(true);
    message.loading({
      content: "正在保存导入表格...",
      key: "import-save",
      duration: 0,
    });

    void replaceWorkbookSheets(activeWorkbookId, sheets)
      .then((result) => {
        if (!Array.isArray(result?.sheets) || result.sheets.length === 0) {
          throw new Error("服务端未返回有效的工作表数据");
        }

        importedSheetsToSizeRef.current = result.sheets;
        setData(result.sheets);
        setKey((current) => current + 1);

        const socket = wsRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ req: "replaceData" }));
        }

        message.success({
          content: "导入并保存成功",
          key: "import-save",
        });
      })
      .catch((saveError) => {
        console.error("导入保存失败", saveError);
        message.error({
          content: "导入保存失败，已保留原工作簿数据",
          key: "import-save",
        });
      })
      .finally(() => {
        importSavingRef.current = false;
        setImportSaving(false);
      });
  }, []);

  useEffect(() => {
    const importedSheets = importedSheetsToSizeRef.current;
    if (!importedSheets) return;

    importedSheetsToSizeRef.current = null;
    let animationFrame = 0;
    let attempts = 0;
    let cancelled = false;

    const applySizingAfterMount = () => {
      animationFrame = window.requestAnimationFrame(() => {
        if (cancelled) return;

        const workbook = workbookRef.current;
        const mountedSheetIds = new Set(
          workbook?.getAllSheets().map((sheet) => sheet.id) ?? [],
        );
        const allSheetsMounted = importedSheets.every((sheet) =>
          mountedSheetIds.has(sheet.id),
        );

        if ((!workbook || !allSheetsMounted) && attempts < 10) {
          attempts += 1;
          applySizingAfterMount();
          return;
        }

        if (!workbook || !allSheetsMounted) {
          console.warn("导入工作表已保存，但等待挂载超时，已跳过行列尺寸同步");
          return;
        }

        importedSheets.forEach((sheet) => {
          try {
            workbook.setColumnWidth(sheet.config?.columnlen ?? {}, {
              id: sheet.id,
            });
            workbook.setRowHeight(sheet.config?.rowlen ?? {}, {
              id: sheet.id,
            });
          } catch (sizingError) {
            console.error(`工作表 ${sheet.id} 行列尺寸同步失败`, sizingError);
          }
        });
      });
    };

    applySizingAfterMount();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [key]);

  const ignoreImportRemount = useCallback(() => undefined, []);

  const hasWorkbookData = Boolean(data);
  useEffect(() => {
    const host = workbookHostRef.current;
    if (!host || !hasWorkbookData) return;

    const handleWheelCapture = (event: WheelEvent) => {
      if (!shouldHandleVerticalWheel(event)) return;
      if (!(event.target instanceof Node)) return;

      const sheetContainer = host.querySelector<HTMLElement>(
        ".fortune-sheet-container",
      );
      if (!sheetContainer?.contains(event.target)) return;

      const verticalScrollbar = host.querySelector<HTMLElement>(
        ".luckysheet-scrollbar-y",
      );
      if (!verticalScrollbar) return;

      verticalScrollbar.scrollTop = calculateWheelScrollTop({
        currentTop: verticalScrollbar.scrollTop,
        scrollHeight: verticalScrollbar.scrollHeight,
        clientHeight: verticalScrollbar.clientHeight,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
      });
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    host.addEventListener("wheel", handleWheelCapture, {
      capture: true,
      passive: false,
    });
    return () => {
      host.removeEventListener("wheel", handleWheelCapture, true);
    };
  }, [hasWorkbookData]);

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
    <Wrapper ref={workbookHostRef}>
      {importSaving && <SavingMask>正在保存导入表格...</SavingMask>}
      <FortuneExcelHelper
        setKey={ignoreImportRemount}
        setSheets={handleImportedSheets}
        sheetRef={excelHelperRef}
        config={{
          // default = all values are true
          import: { xlsx: true, csv: true },
          export: { xlsx: true, csv: true },
        }}
      />
      <Workbook
        key={key}
        ref={workbookRef}
        data={data}
        onChange={onChange}
        onOp={onOp}
        customToolbarItems={[importToolBarItem(), exportToolBarItem()]}
        hooks={{
          afterSelectionChange,
        }}
      />
    </Wrapper>
  );
}

export default Home.bind({});

export const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
`;

export const SavingMask = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  background: rgb(255 255 255 / 68%);
  cursor: wait;
`;

export const SpinWrapper = styled.div`
  background: #fff;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;
