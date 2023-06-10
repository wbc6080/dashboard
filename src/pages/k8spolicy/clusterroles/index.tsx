import { PlusOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import { Button, message, Modal, Input, Select, DatePicker } from "antd";
import React, { useState, useRef, useEffect } from "react";
import { useModel, FormattedMessage } from "umi";
import WrapContent from "@/components/WrapContent";
import type { ProColumns, ActionType } from "@ant-design/pro-table";
import ProTable from "@ant-design/pro-table";
import { getNamespaces } from "@/services/kubeedge";
import type { DeptType, listType } from "./data.d";
import { getList, removeItem, addRole, getYaml } from "./service";
import AddForm from "./components/edit";
import Yaml from "./components/yaml";

const { RangePicker } = DatePicker;

const DeptTableList: React.FC = () => {
  const formTableRef = useRef<FormInstance>();
  const { initialState } = useModel("@@initialState");
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<listType>();

  const [yamlVisible, setYamlVisible] = useState<boolean>(false);
  const [currentYaml, setCurrentYaml] = useState<listType>();

  const handleAdd = async (fields: any) => {
    const hide = message.loading("Adding...");
    try {
      const resp = await addRole({
        ...fields,
      });
      hide();
      if (resp.metadata?.creationTimestamp) {
        message.success("Added successfully");
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

  const handleRemoveOne = async (selectedRow: listType) => {
    const hide = message.loading("Deleting...");
    if (!selectedRow) return true;
    try {
      const resp = await removeItem(selectedRow.name);
      hide();
      if (
        resp.status === "Success" ||
        resp.metadata?.name === selectedRow.name
      ) {
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

  const columns: ProColumns<listType>[] = [
    {
      title: "Name",
      dataIndex: "name",
      valueType: "text",
      renderFormItem: () => (
        <Input
          allowClear
          placeholder="Please enter name"
          style={{ width: 160 }}
        />
      ),
    },
    {
      title: "Creation time",
      dataIndex: "creationTimestamp",
      valueType: "dateTime",
      formItemProps: {
        labelCol: { span: 9 },
      },
      renderFormItem: () => (
        <RangePicker
          style={{ width: 220 }}
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
      render: (_, record) => [
        <Button
          type="link"
          size="small"
          key="batchRemove"
          onClick={async () => {
            const res = await getYaml(record.name);
            setCurrentYaml(res);
            setYamlVisible(true);
          }}
        >
          YAML
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
          headerTitle="Clusterroles"
          actionRef={actionRef}
          formRef={formTableRef}
          rowKey="deptId"
          key="deptList"
          search={{ labelWidth: 120 }}
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
              {"Add Clusterrole"}
            </Button>,
          ]}
          request={(params) =>
            getList().then((res) => {
              const combinedParams = {
                ...params,
                ...formTableRef?.current?.getFieldsValue?.(),
              };
              let filteredRes = res.items;
              let roleList: any[] = [];
              if (combinedParams.name || combinedParams.creationTimestamp) {
                filteredRes = res.items.filter((item: any) => {
                  let nameMatch = true;
                  let creationTimestampMatch = true;
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
                  return nameMatch && creationTimestampMatch;
                });
              }
              filteredRes.forEach(
                (item: { metadata: any; secrets: any; status: any }) => {
                  roleList.push({
                    name: item.metadata.name,
                    uid: item.metadata.uid,
                    creationTimestamp: item.metadata.creationTimestamp,
                  });
                }
              );
              return {
                data: roleList,
                total: roleList.length,
                success: true,
              };
            })
          }
          columns={columns}
        />
      </div>
      <AddForm
        onSubmit={async (values) => {
          let success = false;
          success = await handleAdd({ ...values } as DeptType);
          if (success) {
            setModalVisible(false);
            setCurrentRow(undefined);
            if (actionRef.current) {
              actionRef.current.reload();
            }
          }
        }}
        onCancel={() => {
          setModalVisible(false);
          setCurrentRow(undefined);
        }}
        visible={modalVisible}
        values={currentRow || {}}
      />
      <Yaml
        onSubmit={async (values) => {
          setYamlVisible(false);
          setCurrentYaml(undefined);
          if (actionRef.current) {
            actionRef.current.reload();
          }
        }}
        onCancel={() => {
          setYamlVisible(false);
          setCurrentYaml(undefined);
        }}
        visible={yamlVisible}
        values={currentYaml || {}}
      />
    </WrapContent>
  );
};

export default DeptTableList;
