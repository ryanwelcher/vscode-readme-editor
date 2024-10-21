<?php

/**
 * Plugin Name: Playground Editor
 * Description: A simple plugin to edit rich text formats in Gutenberg.
 */

// Disable welcome panel every time a user accesses the editor
function disable_gutenberg_welcome_on_load()
{
    if (is_admin()) {
        update_user_meta(get_current_user_id(), 'show_welcome_panel', 0);
        remove_action('enqueue_block_editor_assets', 'wp_enqueue_editor_tips');
    }
}
add_action('admin_init', 'disable_gutenberg_welcome_on_load');

// Changes to clean up the interface.
function remove_title_support()
{
    remove_post_type_support('post', 'title');
    remove_post_type_support('post', 'thumbnail');
    wp_update_post(array('ID' => 1, 'post_content' => ''));
}
add_action('init', 'remove_title_support');

function enqueue_script()
{
    wp_enqueue_script('playground-editor-script', plugin_dir_url(__FILE__) . 'script.js', array('jquery'), '1.0', true);
}
add_action('admin_init', 'enqueue_script');

// Set script attribute to module
add_filter('script_loader_tag', function ($tag, $handle, $src) {
    if ($handle === 'playground-editor-script') {
        $tag = '<script type="module" src="' . esc_url($src) . '">' . '<' . '/script>';
    }
    return $tag;
}, 10, 3);
