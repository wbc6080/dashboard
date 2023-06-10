import { PlusOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import { Button, message, Modal, Select, Input, DatePicker } from "antd";
import React, { useState, useRef, useEffect } from "react";
import { useModel } from "umi";
import WrapContent from "@/components/WrapContent";
import type { ProColumns, ActionType } from "@ant-design/pro-table";
import ProTable from "@ant-design/pro-table";
import type { listType } from "./data";
import {
  getList,
  removeItem,
  getDeploymentDetail,
  addDeployment,
} from "./service";
import DetailForm from "./components/detail";
import DeptDrawer from "./components/DeptDrawer";
import { getNamespaces } from "@/services/kubeedge";

const { RangePicker } = DatePicker;

const handleRemoveOne = async (selectedRow: listType) => {
  const hide = message.loading("Deleting...");
  if (!selectedRow) return true;
  try {
    const resp = await removeItem(selectedRow.namespace, selectedRow.name);
    hide();
    if (resp.status === "Success") {
      message.success("Successfully deleted, about to refresh");
    } else {
      message.error(resp.msg);
    }
    return true;
  } catch (error) {
    hide();
    message.error("Deletion failed, please try again");
    return false;
  }
};

const handleDetail = async (namespace: string, name: string) => {
  try {
    const res = await getDeploymentDetail(namespace, name);
    return res;
  } catch (error) {
    message.error("Failed to obtain, please try again!");
    return false;
  }
};

const handleAdd = async (fields: any) => {
  const hide = message.loading("Adding...");
  try {
    const resp = await addDeployment(fields.namespace, {
      ...fields.data,
    });
    hide();
    if (resp.metadata?.creationTimestamp) {
      message.success("Added successfully!");
    } else {
      message.error(resp.msg);
    }
    return true;
  } catch (error) {
    hide();
    message.error("Failed, please try again!");
    return false;
  }
};

const DeptTableList: React.FC = () => {
  const { initialState } = useModel("@@initialState");
  const formTableRef = useRef<FormInstance>();
  const actionRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<listType>();
  const [namespacesList, setNamespacesList] = React.useState<any[]>([]);

  const initNamespacesList = async () => {
    const namespacesListRes = await getNamespaces();
    setNamespacesList([
      {
        label: "All namespaces",
        value: "",
      },
      ...(namespacesListRes?.items || []).map((item: any) => {
        return { label: item.metadata.name, value: item.metadata.name };
      }),
    ]);
  };

  useEffect(() => {
    if (initialState?.namespace === "") {
      initNamespacesList();
    } else {
      setNamespacesList([
        {
          label: initialState.namespace,
          value: initialState.namespace,
        },
      ]);
    }
    formTableRef.current?.resetFields();
  }, [initialState]);

  const columns: ProColumns<listType>[] = [
    {
      title: "Namespace",
      dataIndex: "namespace",
      valueType: "text",
      align: "center",
      formItemProps: {
        labelCol: { span: 8 },
      },
      renderFormItem: () => (
        <Select
          id={`${initialState.namespace}-select`}
          placeholder={"Please select namespace"}
          mode="multiple"
          allowClear
          options={namespacesList}
        />
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      valueType: "text",
      align: "center",
      renderFormItem: () => (
        <Input allowClear placeholder="Please enter name" />
      ),
    },
    {
      title: "Replicas(available/unavailable)",
      dataIndex: "name",
      valueType: "text",
      align: "center",
      search: false,
      render: (_, record) => {
        return (
          (record.availableReplicas ||
            record.replicas - record.unavailableReplicas) +
          "/" +
          record.replicas
        );
      },
    },
    {
      title: "Creation time",
      dataIndex: "creationTimestamp",
      valueType: "dateTime",
      align: "center",
      formItemProps: {
        labelCol: { span: 8 },
      },
      renderFormItem: () => (
        <RangePicker
          allowClear
          placeholder={["Start Time", "End Time"]}
          showTime={{ format: "HH:mm:ss" }}
          format="YYYY-MM-DD HH:mm:ss"
        />
      ),
    },
    {
      title: "Operation",
      dataIndex: "option",
      width: "220px",
      valueType: "option",
      align: "center",
      search: false,
      render: (_, record) => [
        <Button
          type="link"
          size="small"
          key="runOnce"
          onClick={async () => {
            const res = await handleDetail(record.namespace, record.name);
            setDetailModalVisible(true);
            setCurrentRow(res);
          }}
        >
          Detail
        </Button>,
        <Button
          type="link"
          size="small"
          danger
          key="batchRemove"
          onClick={async () => {
            Modal.confirm({
              title: "Delete",
              content: "Are you sure to delete this item?",
              onOk: async () => {
                const success = await handleRemoveOne(record);
                if (success) {
                  if (actionRef.current) {
                    actionRef.current.reload();
                  }
                }
              },
            });
          }}
        >
          Delete
        </Button>,
      ],
    },
  ];

  return (
    <WrapContent>
      <div style={{ width: "100%", float: "right" }}>
        <ProTable<listType>
          headerTitle="Deployment"
          actionRef={actionRef}
          formRef={formTableRef}
          rowKey="deptId"
          key="deptList"
          toolBarRender={() => [
            <Button
              type="primary"
              key="add"
              onClick={async () => {
                setCurrentRow(undefined);
                setModalVisible(true);
              }}
            >
              <PlusOutlined />
              Add Deployment
            </Button>,
          ]}
          params={{ namespaceSetting: initialState.namespace }}
          request={(params) =>
            getList(params.namespaceSetting).then((res) => {
              const combinedParams = {
                ...params,
                ...formTableRef?.current?.getFieldsValue?.(),
              };
              let filteredRes = res.items;
              let deploymentList: any[] = [];
              if (
                combinedParams.namespace?.length ||
                combinedParams.name ||
                combinedParams.creationTimestamp
              ) {
                filteredRes = res.items.filter((item: any) => {
                  let namespaceMatch = true;
                  let nameMatch = true;
                  let creationTimestampMatch = true;
                  if (combinedParams.namespace) {
                    namespaceMatch =
                      combinedParams.namespace.includes("") ||
                      combinedParams.namespace.includes(
                        item.metadata.namespace
                      );
                  }
                  if (combinedParams.name) {
                    nameMatch = item.metadata.name.includes(
                      combinedParams.name
                    );
                  }
                  if (combinedParams.creationTimestamp) {
                    const start = new Date(combinedParams.creationTimestamp[0]);
                    const end = new Date(combinedParams.creationTimestamp[1]);
                    const creationTimestamp = new Date(
                      item.metadata.creationTimestamp
                    );
                    creationTimestampMatch =
                      creationTimestamp >= start && creationTimestamp <= end;
                  }
                  return namespaceMatch && nameMatch && creationTimestampMatch;
                });
              }
              filteredRes.forEach(
                (item: { metadata: any; spec: any; status: any }) => {
                  deploymentList.push({
                    name: item.metadata.name,
                    namespace: item.metadata.namespace,
                    uid: item.metadata.uid,
                    creationTimestamp: item.metadata.creationTimestamp,
                    replicas: item.status.replicas,
                    availableReplicas: item.status.availableReplicas,
                    unavailableReplicas: item.status.unavailableReplicas,
                  });
                }
              );
              return {
                data: deploymentList,
                total: deploymentList.length,
                success: true,
              };
            })
          }
          columns={columns}
        />
      </div>
      <DetailForm
        onCancel={(isUpdate, res) => {
          setDetailModalVisible(isUpdate || false);
          setCurrentRow((res as any) || undefined);
        }}
        visible={detailModalVisible}
        values={currentRow || {}}
      />
      <DeptDrawer
        visible={modalVisible}
        loading={modalLoading}
        onClose={() => setModalVisible(false)}
        onOk={async (values) => {
          setModalLoading(true);
          const success = await handleAdd(values);
          if (success) {
            setModalVisible(false);
            setModalLoading(false);
            if (actionRef.current) {
              actionRef.current.reload();
            }
          }
        }}
      />
    </WrapContent>
  );
};

export default DeptTableList;
