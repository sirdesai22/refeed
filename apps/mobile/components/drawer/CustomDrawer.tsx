import { memo, useEffect } from "react";
import { Image, Pressable } from "react-native";
import TreeView from "react-native-final-tree-view";
import { TouchableOpacity } from "react-native-gesture-handler";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import {
  DrawerActions,
  useNavigation as useNavigationNative,
} from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useAtomValue } from "jotai";
import * as DropdownMenu from "zeego/dropdown-menu";

import { truncateText } from "@refeed/lib/truncateText";

import { removeFeedsOrFolder } from "../../../../packages/features/feed/removeFeedsOrFolders";
import { getTotalChildAmount } from "../../features/getTotalChildAmount";
import { useModifyFeedOrder } from "../../features/useFolderFeedOrder";
import { useMarkAllRead } from "../../features/useMarkRead";
import { DownIcon } from "../../lib/Icons";
import type { NavigatorParams } from "../../lib/navTypes";
import { settingsAtom } from "../../lib/stores/settings";
import { trpc } from "../../utils/trpc";
import { Text } from "../ui/Text";
import { View } from "../ui/View";
import { AccountDropdown } from "./AccountDropdown";
import { AddFolderButtonGray } from "./AddFolderButtons";
import { NoFoldersMessage } from "./NoFolderMessage";

const CustomDrawer = memo(() => {
  const navigation =
    useNavigationNative<StackNavigationProp<NavigatorParams>>();

  const { data: feedsInFolders, refetch } =
    trpc.feed.getFeedsInFolders.useQuery();
  const settings = useAtomValue(settingsAtom);
  const { markAllRead } = useMarkAllRead();

  useEffect(() => {
    refetch();
  }, [settings.SortFeedsByAmountOfUnreadItems]);

  // Filter out feeds with the same feedId (although should figure out how they got there in the first place)
  feedsInFolders?.forEach((folder) => {
    if (folder.children) {
      folder.children = folder.children.filter(
        (v, i, a) => a.findIndex((t) => t.id === v.id) === i,
      );
    }
  });

  // Sort the feeds in each folder based on the amount of unread items
  if (settings.SortFeedsByAmountOfUnreadItems) {
    feedsInFolders?.forEach((folder) => {
      if (folder.children) {
        folder.children.sort((a, b) => b.amount - a.amount);
      }
    });
  }

  const { onToggle } = useModifyFeedOrder();

  const { removeFeed, removeFolder } = removeFeedsOrFolder();

  const totalItemAmount = feedsInFolders?.reduce((acc, folder) => {
    if (folder.children) {
      return (
        acc +
        folder.children.reduce((acc, feed) => {
          return acc + feed.amount;
        }, 0)
      );
    } else {
      return acc;
    }
  }, 0);

  // Remove any duplicates in the same folder
  if (feedsInFolders) {
    feedsInFolders.forEach((folder) => {
      const folderFeeds = folder.children;
      const folderFeedsIds = folderFeeds?.map((feed) => feed.id);
      const uniqueFeeds = folderFeeds?.filter(
        (feed, index) => !folderFeedsIds?.includes(feed.id, index + 1),
      );
      folder.children = uniqueFeeds;
    });
  }

  if (feedsInFolders) {
    return (
      <DrawerContentScrollView
        className="pt-10"
        persistentScrollbar={true}
        bounces={false}
      >
        <View className="mb-2 flex flex-col">
          <AccountDropdown />
        </View>
        {feedsInFolders.length > 0 && (
          <View className="flex w-full flex-row px-1 py-[7px]">
            <TouchableOpacity>
              <View className="ml-3 h-5 w-5 self-center rounded-sm">
                <DownIcon />
              </View>
            </TouchableOpacity>
            <Pressable
              onPress={() => {
                requestAnimationFrame(() => {
                  navigation.dispatch(DrawerActions.closeDrawer());
                });
                navigation.navigate("Feed", {
                  // Remember node is not typed because of the lib
                  screen: "Inbox",
                  type: "all",
                  title: "All Feeds",
                });
              }}
            >
              <Text className="ml-1.5 max-w-[100px] self-center truncate stroke-neutral-700 text-base font-[500]">
                All
              </Text>
            </Pressable>
            <Text.Secondary className="ml-auto mr-4 self-center text-sm text-neutral-400/90">
              {totalItemAmount}
            </Text.Secondary>
          </View>
        )}
        <NoFoldersMessage Empty={feedsInFolders.length == 0} />
        {/** @ts-ignore This libary does not work well with typescript, probably will end up writing my own */}
        <TreeView
          data={feedsInFolders as any[]}
          isNodeExpanded={(node) => {
            const folded =
              feedsInFolders?.find((folder) => {
                return folder.id === node;
              })?.folded ?? false;

            return folded;
          }}
          renderNode={({ node }) => {
            return (
              <>
                {node.children ? (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger action="longPress">
                      <View className="flex w-full flex-row px-1 py-[7px]">
                        <TouchableOpacity onPress={() => onToggle(node.name)}>
                          <View className="ml-3 h-5 w-5 self-center rounded-sm">
                            <DownIcon />
                          </View>
                        </TouchableOpacity>
                        <Pressable
                          onPress={() => {
                            requestAnimationFrame(() => {
                              navigation.dispatch(DrawerActions.closeDrawer());
                            });
                            navigation.navigate("Feed", {
                              // Remember node is not typed because of the lib
                              screen: "Inbox",
                              type: "multiple",
                              folder: node.name,
                            });
                          }}
                        >
                          <Text className="ml-1.5 max-w-[100px] self-center truncate text-base font-[500]">
                            {truncateText(node.name, 18)}
                          </Text>
                        </Pressable>
                        <Pressable
                          className="flex-1 self-center"
                          onPress={() => {
                            requestAnimationFrame(() => {
                              navigation.dispatch(DrawerActions.closeDrawer());
                            });
                            navigation.navigate("Feed", {
                              // Remember node is not typed because of the lib
                              screen: "Inbox",
                              type: "multiple",
                              title: node.name,
                            });
                          }}
                        >
                          <Text.Secondary className="ml-auto mr-4 self-center text-sm text-neutral-400/80">
                            {getTotalChildAmount(node)}
                          </Text.Secondary>
                        </Pressable>
                      </View>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Label>{node.name}</DropdownMenu.Label>
                      <DropdownMenu.Item
                        onSelect={() => {
                          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                          const feedIds = node.children?.map(
                            (feed: { id: string }) => feed.id,
                          );

                          markAllRead("folder", feedIds);
                        }}
                        key="markallread"
                      >
                        <DropdownMenu.ItemTitle>
                          Mark as Read
                        </DropdownMenu.ItemTitle>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        key="remove"
                        onSelect={() => {
                          removeFolder(node.name);
                        }}
                      >
                        <DropdownMenu.ItemTitle>
                          Delete Folder
                        </DropdownMenu.ItemTitle>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                ) : (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger action="longPress">
                      <Pressable
                        onPress={() => {
                          requestAnimationFrame(() => {
                            navigation.dispatch(DrawerActions.closeDrawer());
                          });
                          navigation.navigate("Feed", {
                            // Remember node is not typed because of the lib
                            screen: "Inbox",
                            feedId: node.id,
                            type: "one",
                            title: node.name,
                          });
                        }}
                        className="flex flex-row px-1 py-[7px]"
                      >
                        <View className="ml-[38px] h-[22px] w-[22px] self-center">
                          <Image
                            className="h-full w-full rounded-[2px]"
                            progressiveRenderingEnabled
                            source={{
                              uri: node.logo_url as string,
                            }}
                          />
                        </View>
                        <Text
                          className="ml-2 w-44 self-center truncate text-[15px] font-[500] text-neutral-700"
                          numberOfLines={1}
                        >
                          {truncateText(node.name, 18)}
                        </Text>
                        <View className="mx-auto" />
                        <Text.Secondary className="mr-4 self-center text-sm text-neutral-400/80">
                          {node.amount + ""}
                        </Text.Secondary>
                      </Pressable>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Label>{node.name}</DropdownMenu.Label>
                      <DropdownMenu.Item
                        onSelect={() => markAllRead("one", node.id)}
                        key="markallread"
                      >
                        <DropdownMenu.ItemTitle>
                          Mark as Read
                        </DropdownMenu.ItemTitle>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        key="remove"
                        onSelect={() => {
                          removeFeed(node.id);
                        }}
                      >
                        <DropdownMenu.ItemTitle>
                          Delete Feed
                        </DropdownMenu.ItemTitle>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                )}
              </>
            );
          }}
        />
        {feedsInFolders?.length && <AddFolderButtonGray />}
      </DrawerContentScrollView>
    );
  }
});

CustomDrawer.displayName == "CustomDrawer";

export default CustomDrawer;
